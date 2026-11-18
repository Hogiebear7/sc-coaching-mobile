import { describe, expect, it } from "vitest";

import { applyWeightFrom, bodyweightFrom, normalizeWeights, sanitizeWeight, stripWeightUnit, weightUnitFor, withWeightUnit } from "../weight-input";

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

describe("bodyweight (BW)", () => {
  it("is left alone when the unit is added or removed, and typing still keeps numbers only", () => {
    expect(withWeightUnit("BW", "kg")).toBe("BW");
    expect(stripWeightUnit("BW")).toBe("BW");
    expect(sanitizeWeight("BW")).toBe("");
    expect(sanitizeWeight("BW5")).toBe("5");
  });

  it("carries down to the sets below, like a typed weight, and never changes the ones above", () => {
    const sets = [{ key: "a", weight: "40" }, { key: "b", weight: "40" }, { key: "c", weight: "40" }];
    expect(applyWeightFrom(sets, "b", "BW").map((s) => s.weight)).toEqual(["40", "BW", "BW"]);
    expect(normalizeWeights([{ weight: "BW" }, { weight: "40" }], "kg").map((s) => s.weight)).toEqual(["BW", "40 kg"]);
  });
});

describe("bodyweightFrom keeps what was typed", () => {
  const sets = () => [{ key: "a", weight: "40 kg" }, { key: "b", weight: "50 kg" }, { key: "c", weight: "" }];
  it("turns BW on from a set downwards and never touches the sets above it", () => {
    const on = bodyweightFrom(sets(), "b");
    expect(on.map((s) => s.weight)).toEqual(["40 kg", "BW", "BW"]);
  });
  it("turning it off brings back each set's own number", () => {
    const off = bodyweightFrom(bodyweightFrom(sets(), "b"), "b");
    expect(off.map((s) => s.weight)).toEqual(["40 kg", "50 kg", ""]);
    expect(off.every((s) => s.modeValues === undefined)).toBe(true);
  });
  it("turning it off on a later set leaves an earlier BW set alone", () => {
    const on = bodyweightFrom(sets(), "a");
    const partlyOff = bodyweightFrom(on, "c");
    expect(partlyOff.map((s) => s.weight)).toEqual(["BW", "BW", ""]);
  });
  it("keeps the other units' saved values", () => {
    const withTime = [{ key: "a", weight: "30", modeValues: { time: "1:00" } as Partial<Record<"weight" | "time" | "band" | "bwPrev", string>> }];
    const off = bodyweightFrom(bodyweightFrom(withTime, "a"), "a");
    expect(off[0].weight).toBe("30");
    expect(off[0].modeValues).toEqual({ time: "1:00" });
  });
});

