import { describe, expect, it } from "vitest";

import { extraRows, formatGrams, formatSodium, noExtrasKnown, pickExtras, scaleExtras, type ExtraTotals } from "../nutrient-extras";

const totals = (over: Partial<ExtraTotals> = {}): ExtraTotals => ({
  fiberG: 7.2,
  sugarG: 10.5,
  sodiumMg: 1240,
  saturatedFatG: 2,
  missing: { fiberG: 0, sugarG: 1, sodiumMg: 0, saturatedFatG: 3 },
  totalEntries: 3,
  ...over,
});

describe("pickExtras", () => {
  it("keeps known numbers (including a real zero) and drops null and junk", () => {
    expect(pickExtras({ fiberG: 0, sugarG: null, sodiumMg: 300, saturatedFatG: undefined })).toEqual({ fiberG: 0, sodiumMg: 300 });
    expect(pickExtras({ fiberG: -2, sugarG: NaN })).toBeNull();
    expect(pickExtras(null)).toBeNull();
  });
});

describe("formatting", () => {
  it("shows at most one decimal and no trailing .0", () => {
    expect(formatGrams(12)).toBe("12");
    expect(formatGrams(4.26)).toBe("4.3");
    expect(formatGrams(4.04)).toBe("4");
  });
  it("shows sodium in mg with separators", () => {
    expect(formatSodium(1240)).toBe("1,240 mg");
    expect(formatSodium(95.4)).toBe("95 mg");
  });
});

describe("extraRows", () => {
  it("returns nothing for an empty day", () => {
    expect(extraRows(totals({ totalEntries: 0 }))).toBeNull();
    expect(extraRows(null)).toBeNull();
  });
  it("flags a nutrient as 'at least' when some entries did not list it", () => {
    const rows = extraRows(totals())!;
    expect(rows.map((r) => [r.label, r.value, r.atLeast])).toEqual([
      ["Fibre", "7.2 g", false],
      ["Sugars", "10.5 g", true],
      ["Sodium", "1,240 mg", false],
      ["Sat. fat", "2 g", true],
    ]);
  });
  it("adds everyday guideline notes for fibre and sodium only", () => {
    const rows = extraRows(totals())!;
    expect(rows[0].note).toBe("Guide 25 g+");
    expect(rows[2].note).toBe("Guide under 2,000 mg");
    expect(rows[1].note).toBeNull();
  });
});

describe("noExtrasKnown", () => {
  it("is true only when every entry is missing all four", () => {
    expect(noExtrasKnown(totals({ missing: { fiberG: 3, sugarG: 3, sodiumMg: 3, saturatedFatG: 3 } }))).toBe(true);
    expect(noExtrasKnown(totals())).toBe(false);
    expect(noExtrasKnown(totals({ totalEntries: 0, missing: { fiberG: 0, sugarG: 0, sodiumMg: 0, saturatedFatG: 0 } }))).toBe(false);
  });
});

describe("scaleExtras", () => {
  it("scales a portion, grams to one decimal and sodium to whole mg", () => {
    expect(scaleExtras({ fiberG: 3, sugarG: 10.5, sodiumMg: 300, saturatedFatG: 1.2 }, 1.5)).toEqual({ fiberG: 4.5, sugarG: 15.8, sodiumMg: 450, saturatedFatG: 1.8 });
  });
  it("keeps only what is known, and returns null for nothing known or a bad factor", () => {
    expect(scaleExtras({ fiberG: 2 }, 2)).toEqual({ fiberG: 4 });
    expect(scaleExtras(null, 2)).toBeNull();
    expect(scaleExtras({}, 2)).toBeNull();
    expect(scaleExtras({ fiberG: 2 }, -1)).toBeNull();
    expect(scaleExtras({ fiberG: 2 }, NaN)).toBeNull();
  });
});
