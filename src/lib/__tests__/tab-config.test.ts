import { describe, expect, it } from "vitest";

import { barTabsForTier, swipeTabsForTier } from "@/lib/tab-config";
import { resolveScheme } from "@/lib/theme-scheme";

describe("barTabsForTier", () => {
  it("gives gym members the class schedule", () => {
    expect(barTabsForTier("membership")).toEqual(["index", "schedule", "add", "workouts", "more"]);
  });

  it("gives app-only and free members nutrition instead", () => {
    expect(barTabsForTier("app_subscription")).toEqual(["index", "workouts", "add", "nutrition", "more"]);
    expect(barTabsForTier("free")).toEqual(barTabsForTier("app_subscription"));
  });

  it("always has five slots with + in the middle", () => {
    for (const t of ["free", "app_subscription", "membership"] as const) {
      const tabs = barTabsForTier(t);
      expect(tabs).toHaveLength(5);
      expect(tabs[2]).toBe("add");
    }
  });

  it("swipe order skips the + slot", () => {
    expect(swipeTabsForTier("membership")).toEqual(["index", "schedule", "workouts", "more"]);
  });
});

describe("resolveScheme", () => {
  it("is pinned to dark until light mode ships", () => {
    expect(resolveScheme("light", "light", false)).toBe("dark");
  });

  it("follows the system when allowed", () => {
    expect(resolveScheme("system", "light", true)).toBe("light");
    expect(resolveScheme("system", null, true)).toBe("dark");
    expect(resolveScheme("dark", "light", true)).toBe("dark");
  });
});
