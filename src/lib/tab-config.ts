// Bottom-bar layout per member tier (App v2). Pure, so it is unit-tested.
//
// Gym members get the class Schedule in the bar; app-only and free members
// have no classes to book, so Nutrition takes that slot. "add" is the centre
// "+" (opens the quick-action sheet, not a screen). Routes not in the bar
// stay reachable from Home tiles, the "+" sheet and More.
import type { MemberTier } from "@/lib/member-access";

export type TabRoute = "index" | "schedule" | "add" | "workouts" | "nutrition" | "recovery" | "more";

export const ALL_TAB_ROUTES: readonly TabRoute[] = ["index", "schedule", "add", "workouts", "nutrition", "recovery", "more"];

export function barTabsForTier(tier: MemberTier): TabRoute[] {
  if (tier === "membership") return ["index", "schedule", "add", "workouts", "more"];
  return ["index", "workouts", "add", "nutrition", "more"];
}

// Screen tabs in bar order (the "+" slot is not swipeable).
export function swipeTabsForTier(tier: MemberTier): TabRoute[] {
  return barTabsForTier(tier).filter((r) => r !== "add");
}
