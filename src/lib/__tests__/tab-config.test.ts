import { describe, expect, it } from "vitest";

import {
  barTabsForTier,
  canChooseTabs,
  MAIN_USE_TABS,
  normaliseChoice,
  swapTab,
  swipeTabsForTier,
} from "@/lib/tab-config";
import { resolveScheme } from "@/lib/theme-scheme";

describe("barTabsForTier", () => {
  it("defaults gym members to Schedule and Train", () => {
    expect(barTabsForTier("membership")).toEqual(["index", "schedule", "add", "workouts", "more"]);
  });

  it("gives app-only and free members Train and Nutrition", () => {
    expect(barTabsForTier("app_subscription")).toEqual(["index", "workouts", "add", "nutrition", "more"]);
    expect(barTabsForTier("free")).toEqual(barTabsForTier("app_subscription"));
  });

  it("uses the member's choice, in bar order", () => {
    expect(barTabsForTier("membership", ["nutrition", "schedule"])).toEqual(["index", "schedule", "add", "nutrition", "more"]);
    expect(barTabsForTier("membership", ["nutrition", "workouts"])).toEqual(["index", "workouts", "add", "nutrition", "more"]);
  });

  it("always has five distinct slots with + in the middle", () => {
    for (const t of ["free", "app_subscription", "membership"] as const) {
      for (const choice of [null, ["schedule", "nutrition"], ["nutrition"], ["bogus", "x"]]) {
        const tabs = barTabsForTier(t, choice);
        expect(tabs).toHaveLength(5);
        expect(tabs[2]).toBe("add");
        expect(new Set(tabs).size).toBe(5);
      }
    }
  });

  it("swipe order skips the + slot", () => {
    expect(swipeTabsForTier("membership")).toEqual(["index", "schedule", "workouts", "more"]);
  });
});

describe("normaliseChoice", () => {
  it("drops Schedule for members without a gym membership", () => {
    expect(normaliseChoice(["schedule", "nutrition"], "free")).toEqual(["workouts", "nutrition"]);
  });
  it("fills a missing or duplicate pick from the default", () => {
    expect(normaliseChoice(["nutrition"], "membership")).toEqual(["schedule", "nutrition"]);
    expect(normaliseChoice(["workouts", "workouts"], "membership")).toEqual(["schedule", "workouts"]);
  });
});

describe("swapTab", () => {
  it("replaces one tab with another", () => {
    expect(swapTab(["schedule", "workouts"], "schedule", "nutrition", "membership")).toEqual(["workouts", "nutrition"]);
    expect(swapTab(["schedule", "workouts"], "workouts", "nutrition", "membership")).toEqual(["schedule", "nutrition"]);
  });
});

describe("choice rules", () => {
  it("only gym members can choose (others have exactly two options)", () => {
    expect(canChooseTabs("membership")).toBe(true);
    expect(canChooseTabs("app_subscription")).toBe(false);
  });
  it("maps the onboarding answer to tabs", () => {
    expect(MAIN_USE_TABS.nutrition).toEqual(["schedule", "nutrition"]);
    expect(MAIN_USE_TABS.both).toEqual(["workouts", "nutrition"]);
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
