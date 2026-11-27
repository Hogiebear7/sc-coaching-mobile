import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_BRANDING, getGymBranding, parseBranding, resetGymBranding, setGymBranding } from "../gym-branding";

afterEach(() => resetGymBranding());

describe("gym branding", () => {
  it("an older server, a default gym and junk all read as the S&C default", () => {
    for (const raw of [undefined, null, "x", 5, {}, { custom: false, name: "Gym B" }]) expect(parseBranding(raw)).toEqual(DEFAULT_BRANDING);
  });

  it("takes a gym's own name, colour and https logo", () => {
    expect(parseBranding({ custom: true, name: "Gym B", accentColor: "#4DA3FF", onAccent: "#0A1526", logoUrl: "https://cdn.example.test/b.png" })).toEqual({
      name: "Gym B", accentColor: "#4DA3FF", onAccent: "#0A1526", logoUrl: "https://cdn.example.test/b.png", logoBackground: "dark", custom: true,
    });
  });

  it("reads the logo background the gym chose, dark by default", () => {
    expect(parseBranding({ custom: true, name: "G", logoUrl: "https://x.test/a.png", logoBackground: "light" }).logoBackground).toBe("light");
    expect(parseBranding({ custom: true, name: "G", logoUrl: "https://x.test/a.png" }).logoBackground).toBe("dark");
    expect(parseBranding({ custom: true, name: "G", logoBackground: "purple" }).logoBackground).toBe("dark");
  });

  it("never uses a logo that is not https, or a colour that is not a hex", () => {
    const b = parseBranding({ custom: true, name: "Gym B", accentColor: "red", onAccent: "javascript:1", logoUrl: "http://x.test/a.png" });
    expect(b.logoUrl).toBeNull();
    expect(b.accentColor).toBe(DEFAULT_BRANDING.accentColor);
    expect(b.onAccent).toBe(DEFAULT_BRANDING.onAccent);
  });

  it("is set from the session check and cleared on sign-out", () => {
    setGymBranding({ custom: true, name: "Gym B", accentColor: "#4DA3FF", onAccent: "#0A1526", logoUrl: null });
    expect(getGymBranding().name).toBe("Gym B");
    resetGymBranding();
    expect(getGymBranding()).toEqual(DEFAULT_BRANDING);
  });
});
