import { describe, expect, it } from "vitest";

import { anyMicrosKnown, contributors, formatAmount, groupMicros, topKnownMicros, type MicroTotalView } from "../micronutrients";

const t = (key: string, group: MicroTotalView["group"], listedBy: number, patch: Partial<MicroTotalView> = {}): MicroTotalView => ({
  key, label: key, unit: "mg", group, total: listedBy, listedBy, entryCount: 4, atLeast: listedBy < 4, coverage: "", display: listedBy ? `${listedBy} mg` : "No data", ...patch,
});
const TOTALS = [t("iron", "mineral", 2), t("zinc", "mineral", 0), t("c", "vitamin", 4), t("d", "vitamin", 1), t("o3", "fat", 0)];

describe("anyMicrosKnown", () => {
  it("is true only when some nutrient has data", () => {
    expect(anyMicrosKnown(TOTALS)).toBe(true);
    expect(anyMicrosKnown(TOTALS.map((x) => ({ ...x, listedBy: 0 })))).toBe(false);
    expect(anyMicrosKnown(undefined)).toBe(false);
  });
});

describe("groupMicros", () => {
  it("groups into vitamins, minerals, fats in that order and skips empty groups", () => {
    expect(groupMicros(TOTALS).map((g) => [g.label, g.items.map((i) => i.key)])).toEqual([["Vitamins", ["c", "d"]], ["Minerals", ["iron", "zinc"]], ["Fats", ["o3"]]]);
    expect(groupMicros(TOTALS.filter((x) => x.group !== "fat")).map((g) => g.label)).toEqual(["Vitamins", "Minerals"]);
    expect(groupMicros(null)).toEqual([]);
  });
});

describe("topKnownMicros", () => {
  it("lists nutrients with data, best covered first, never ones with none", () => {
    expect(topKnownMicros(TOTALS, 3).map((x) => x.key)).toEqual(["c", "iron", "d"]);
    expect(topKnownMicros(TOTALS, 1).map((x) => x.key)).toEqual(["c"]);
    expect(topKnownMicros(TOTALS.filter((x) => x.listedBy === 0))).toEqual([]);
  });
});

describe("contributors", () => {
  const entries = [
    { id: "1", name: "Spinach", micros: { ironMg: 2.7 } },
    { id: "2", name: "Beef", micros: { ironMg: 2.6, zincMg: 5 } },
    { id: "3", name: "Spinach", micros: { ironMg: 1 } },
    { id: "4", name: "Toast" },
    { id: "5", name: "Zero", micros: { ironMg: 0 } },
  ];
  it("adds the same food up, ranks biggest first, and ignores foods that do not list it or list zero", () => {
    expect(contributors(entries, "ironMg")).toEqual([{ name: "Spinach", value: 3.7 }, { name: "Beef", value: 2.6 }]);
    expect(contributors(entries, "zincMg")).toEqual([{ name: "Beef", value: 5 }]);
    expect(contributors(entries, "folateUg")).toEqual([]);
    expect(contributors(null, "ironMg")).toEqual([]);
  });
});

describe("formatAmount", () => {
  it("drops trailing zeros", () => {
    expect(formatAmount(12.5, "mg")).toBe("12.5 mg");
    expect(formatAmount(190, "µg")).toBe("190 µg");
    expect(formatAmount(0.456, "g")).toBe("0.46 g");
  });
});
