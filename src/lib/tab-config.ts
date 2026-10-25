// Bottom-bar layout (App v2). Pure, so it is unit-tested.
//
// The bar is Home · [choice 1] · + · [choice 2] · More. The two middle tabs
// are the member's choice from Schedule, Train and Nutrition (set in
// onboarding, Settings, or by long-pressing a tab). Gym members can pick
// any two; app-only and free members have no classes to book, so they always
// get Train and Nutrition. "add" is the centre "+" (opens the quick-action
// sheet, not a screen). Routes not in the bar stay reachable from Home
// tiles, the "+" sheet and More.
import type { MemberTier } from "@/lib/member-access";

export type TabRoute = "index" | "schedule" | "add" | "workouts" | "nutrition" | "recovery" | "more";
export type ChoosableTab = "schedule" | "workouts" | "nutrition";
export type TabChoice = [ChoosableTab, ChoosableTab];

export const ALL_TAB_ROUTES: readonly TabRoute[] = ["index", "schedule", "add", "workouts", "nutrition", "recovery", "more"];

// Bar order for the choosable tabs, whatever order they were picked in.
const CANONICAL_ORDER: readonly ChoosableTab[] = ["schedule", "workouts", "nutrition"];

export const TAB_PAIR_OPTIONS: { value: TabChoice; label: string }[] = [
  { value: ["schedule", "workouts"], label: "Schedule + Train" },
  { value: ["schedule", "nutrition"], label: "Schedule + Nutrition" },
  { value: ["workouts", "nutrition"], label: "Train + Nutrition" },
];

// What a member says they mainly use the app for (onboarding) -> their tabs.
export type MainUse = "training" | "nutrition" | "both";
export const MAIN_USE_TABS: Record<MainUse, TabChoice> = {
  training: ["schedule", "workouts"],
  nutrition: ["schedule", "nutrition"],
  both: ["workouts", "nutrition"],
};

export function choosableTabsForTier(tier: MemberTier): ChoosableTab[] {
  return tier === "membership" ? ["schedule", "workouts", "nutrition"] : ["workouts", "nutrition"];
}

export function canChooseTabs(tier: MemberTier): boolean {
  return choosableTabsForTier(tier).length > 2;
}

export function defaultChoiceForTier(tier: MemberTier): TabChoice {
  return tier === "membership" ? ["schedule", "workouts"] : ["workouts", "nutrition"];
}

// Any stored choice -> exactly two allowed, distinct tabs in bar order. Tabs
// the tier can't use (Schedule without a membership) are dropped and the
// gap is filled from the tier's default.
export function normaliseChoice(choice: readonly string[] | null | undefined, tier: MemberTier): TabChoice {
  const allowed = choosableTabsForTier(tier);
  const picked: ChoosableTab[] = [];
  for (const t of [...(choice ?? []), ...defaultChoiceForTier(tier), ...allowed]) {
    if ((allowed as string[]).includes(t) && !picked.includes(t as ChoosableTab)) picked.push(t as ChoosableTab);
    if (picked.length === 2) break;
  }
  picked.sort((a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b));
  return [picked[0], picked[1]];
}

// Replace one tab in the bar with another (the long-press swap).
export function swapTab(choice: TabChoice, out: ChoosableTab, into: ChoosableTab, tier: MemberTier): TabChoice {
  return normaliseChoice(
    choice.map((t) => (t === out ? into : t)),
    tier
  );
}

export function barTabsForTier(tier: MemberTier, choice?: readonly string[] | null): TabRoute[] {
  const [first, second] = normaliseChoice(choice, tier);
  return ["index", first, "add", second, "more"];
}

// Screen tabs in bar order (the "+" slot is not swipeable).
export function swipeTabsForTier(tier: MemberTier, choice?: readonly string[] | null): TabRoute[] {
  return barTabsForTier(tier, choice).filter((r) => r !== "add");
}
