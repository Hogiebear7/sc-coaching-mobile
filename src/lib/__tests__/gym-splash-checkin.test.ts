import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(() => Promise.resolve(null)), setItem: vi.fn(() => Promise.resolve()), removeItem: vi.fn(() => Promise.resolve()) },
}));

import { getSelfCheckin, parseSelfCheckin, resetSelfCheckin, setSelfCheckin } from "../gym-checkin";
import { parseGymSplash, splashFromBranding } from "../gym-splash";

describe("gym splash", () => {
  it("keeps only an https logo", () => {
    expect(parseGymSplash({ logoUrl: "https://cdn.example.test/a.png", name: "Iron Works" })).toEqual({ logoUrl: "https://cdn.example.test/a.png", name: "Iron Works", background: "dark" });
    expect(parseGymSplash(JSON.stringify({ logoUrl: "https://x.test/a.png", name: " " }))).toEqual({ logoUrl: "https://x.test/a.png", name: "Your gym", background: "dark" });
    for (const bad of [null, undefined, "nonsense", 5, {}, { logoUrl: "http://x.test/a.png" }, { logoUrl: "data:image/png;base64,AAA" }]) expect(parseGymSplash(bad)).toBeNull();
  });
  it("remembers a logo only for a gym with its own look and logo", () => {
    expect(splashFromBranding({ custom: true, logoUrl: "https://x.test/a.png", name: "G" })).toEqual({ logoUrl: "https://x.test/a.png", name: "G", background: "dark" });
    expect(splashFromBranding({ custom: true, logoUrl: "https://x.test/a.png", name: "G", logoBackground: "light" })?.background).toBe("light");
    expect(splashFromBranding({ custom: true, logoUrl: null, name: "G" })).toBeNull();
    expect(splashFromBranding({ custom: false, logoUrl: "https://x.test/a.png", name: "S&C" })).toBeNull();
  });
});

describe("self check-in mode", () => {
  it("reads off, poster and live; everything else is off", () => {
    expect(parseSelfCheckin("poster")).toBe("poster");
    expect(parseSelfCheckin("live")).toBe("live");
    for (const bad of [undefined, null, "", "on", 1, {}]) expect(parseSelfCheckin(bad)).toBe("off");
  });
  it("is set from the session check and cleared on sign-out", () => {
    setSelfCheckin("live");
    expect(getSelfCheckin()).toBe("live");
    resetSelfCheckin();
    expect(getSelfCheckin()).toBe("off");
  });
});
