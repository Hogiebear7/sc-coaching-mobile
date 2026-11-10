import { describe, expect, it } from "vitest";

import { DEFAULT_DRINK, DRINK_TYPES, drinkNote, findDrink, waterEquivalentMl } from "@/lib/drink-types";

describe("drink types", () => {
  it("starts on water and never counts a drink for more than it is, or for nothing", () => {
    expect(DEFAULT_DRINK).toBe("water");
    for (const d of DRINK_TYPES) {
      expect(d.share).toBeGreaterThan(0.5);
      expect(d.share).toBeLessThanOrEqual(1);
    }
    expect(new Set(DRINK_TYPES.map((d) => d.id)).size).toBe(DRINK_TYPES.length);
  });

  it("converts a drink to the water it counts as", () => {
    expect(waterEquivalentMl(250, "water")).toBe(250);
    expect(waterEquivalentMl(250, "coffee")).toBe(238);
    expect(waterEquivalentMl(500, "soda")).toBe(450);
    expect(waterEquivalentMl(250, "milk")).toBe(250);
  });

  it("gives a whole number, and zero for rubbish", () => {
    expect(Number.isInteger(waterEquivalentMl(333, "tea"))).toBe(true);
    expect(waterEquivalentMl(0, "water")).toBe(0);
    expect(waterEquivalentMl(-5, "water")).toBe(0);
    expect(waterEquivalentMl(Number.NaN, "water")).toBe(0);
  });

  it("explains a drink that counts for less, and says nothing for one that counts in full", () => {
    expect(drinkNote("coffee")).toBe("Coffee counts as 95% towards your goal.");
    expect(drinkNote("water")).toBeNull();
    expect(findDrink("sports").label).toBe("Sports drink");
  });
});
