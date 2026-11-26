import { describe, expect, it } from "vitest";

import { LIGHT_BACKGROUND, MIN_CONTRAST, accentForScheme, contrastRatio, withBrand } from "../gym-accent";

describe("a gym's accent colour on each theme", () => {
  it("is used as it is on the dark theme", () => {
    expect(accentForScheme("#E5B84B", "dark")).toBe("#e5b84b");
  });

  it("is darkened on the light theme until it reads clearly there", () => {
    const pale = "#F2E18A"; // reads well on navy, nearly invisible on a pale background
    expect(contrastRatio(pale, LIGHT_BACKGROUND)).toBeLessThan(MIN_CONTRAST);
    const out = accentForScheme(pale, "light")!;
    expect(contrastRatio(out, LIGHT_BACKGROUND)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(out).not.toBe(pale.toLowerCase());
  });

  it("leaves a colour that already reads on the light theme alone", () => {
    expect(accentForScheme("#1F4FA8", "light")).toBe("#1f4fa8");
  });

  it("gives nothing for anything that is not a plain #RRGGBB colour", () => {
    for (const bad of [null, undefined, "", "red", "#fff", "#12345", "#GGGGGG", "javascript:alert(1)"]) expect(accentForScheme(bad as never, "dark")).toBeNull();
  });
});

describe("swapping the brand colour", () => {
  const base = { brand: "#c6a15b", text: "#fff" };

  it("changes only the brand colour and returns the same object for the same inputs", () => {
    const a = withBrand(base, "#e5b84b", "dark");
    expect(a).toEqual({ brand: "#e5b84b", text: "#fff" });
    expect(withBrand(base, "#e5b84b", "dark")).toBe(a);
  });

  it("gives the base back untouched when there is no gym colour", () => {
    expect(withBrand(base, null, "dark")).toBe(base);
  });
});
