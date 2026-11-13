import { describe, expect, it } from "vitest";

import { applyWeightFrom, normalizeWeights, sanitizeWeight, stripWeightUnit, weightUnitFor, withWeightUnit } from "../weight-input";

describe("sanitizeWeight", () => {
  it("lets numbers and one decimal point through and drops everything else", () => {
    expect(sanitizeWeight("40")).toBe("40");
    expect(sanitizeWeight("42.5")).toBe("42.5");
    expect(sanitizeWeight("4a0kg")).toBe("40");
    expect(sanitizeWeight("purple")).toBe("");
  });

  it("takes a comma as a point, allows two decimals, and only one point", () => {
    expect(sanitizeWeight("42,5")).toBe("42.5");
    expect(sanitizeWeight("42.255")).toBe("42.25");
    expect(sanitizeWeight("4.2.5")).toBe("4.25");
    expect(sanitizeWeight(".5")).toBe(".5");
  });
});

describe("units", () => {
  it("adds the unit to a plain number only", () => {
    expect(withWeightUnit("40", "kg")).toBe("40 kg");
    expect(withWeightUnit("40 kg", "lbs")).toBe("40 lbs");
    expect(withWeightUnit("", "kg")).toBe("");
    expect(withWeightUnit("Purple", "kg")).toBe("Purple");
  });

  it("strips it back off for editing", () => {
    expect(stripWeightUnit("40 kg")).toBe("40");
    expect(stripWeightUnit("42.5kg")).toBe("42.5");
    expect(stripWeightUnit("100 lbs")).toBe("100");
    expect(stripWeightUnit("Purple")).toBe("Purple");
  });

  it("uses pounds only for an imperial member", () => {
    expect(weightUnitFor("imperial")).toBe("lbs");
    expect(weightUnitFor("metric")).toBe("kg");
    expect(weightUnitFor(undefined)).toBe("kg");
  });
});

describe("carrying a weight down", () => {
  const sets = [
    { key: "a", weight: "40" },
    { key: "b", weight: "40" },
    { key: "c", weight: "40" },
    { key: "d", weight: "40" },
  ];

  it("changes that set and every set below it, never the ones above", () => {
    expect(applyWeightFrom(sets, "c", "45").map((s) => s.weight)).toEqual(["40", "40", "45", "45"]);
    expect(applyWeightFrom(sets, "a", "30").map((s) => s.weight)).toEqual(["30", "30", "30", "30"]);
  });

  it("changes sets below even when they had been set to something else", () => {
    const mixed = [{ key: "a", weight: "40" }, { key: "b", weight: "50" }, { key: "c", weight: "35" }];
    expect(applyWeightFrom(mixed, "a", "42").map((s) => s.weight)).toEqual(["42", "42", "42"]);
  });

  it("puts the unit on all of them", () => {
    expect(normalizeWeights(sets, "kg").map((s) => s.weight)).toEqual(["40 kg", "40 kg", "40 kg", "40 kg"]);
  });
});
