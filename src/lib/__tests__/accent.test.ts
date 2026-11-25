import { describe, expect, it } from "vitest";

import { DarkPalette, LightPalette } from "@/constants/theme";

import { ACCENT_CHOICES, applyAccent, isAccentVariant } from "../accent";

describe("colour accent options", () => {
  it("none is exactly today's palette, so nothing changes by default", () => {
    expect(applyAccent(DarkPalette, "none", "dark")).toBe(DarkPalette);
    expect(applyAccent(LightPalette, "none", "light")).toBe(LightPalette);
    expect(DarkPalette.areas).toEqual({});
    expect(DarkPalette.accent).toBe(DarkPalette.text);
  });

  it("each option changes only the accent fields and keeps every other colour", () => {
    for (const v of ["gold", "areas", "blue"] as const) {
      const p = applyAccent(DarkPalette, v, "dark");
      expect({ ...p, accent: 0, accentLink: 0, areas: 0 }).toEqual({ ...DarkPalette, accent: 0, accentLink: 0, areas: 0 });
      expect(p).not.toBe(DarkPalette);
    }
  });

  it("gives the same object for the same inputs (styles are cached per palette)", () => {
    expect(applyAccent(DarkPalette, "gold", "dark")).toBe(applyAccent(DarkPalette, "gold", "dark"));
    expect(applyAccent(DarkPalette, "gold", "dark")).not.toBe(applyAccent(LightPalette, "gold", "light"));
  });

  it("by area colours the tab routes, and the single-colour options leave areas empty", () => {
    const areas = applyAccent(DarkPalette, "areas", "dark");
    expect(areas.areas.nutrition).toBeTruthy();
    expect(areas.areas.workouts).not.toBe(areas.areas.nutrition);
    expect(applyAccent(DarkPalette, "gold", "dark").areas).toEqual({});
    expect(applyAccent(DarkPalette, "gold", "dark").accent).toBe("#c6a15b");
  });

  it("lists four options and validates a stored value", () => {
    expect(ACCENT_CHOICES.map((c) => c.key)).toEqual(["none", "gold", "areas", "blue"]);
    expect(isAccentVariant("gold")).toBe(true);
    expect(isAccentVariant("pink")).toBe(false);
    expect(isAccentVariant(null)).toBe(false);
  });
});
