// Pure helpers for the "Set up your plan" onboarding (app/onboarding.tsx).
// No React Native imports, so they're unit-tested.

export type GoalDirection = "lose" | "maintain" | "gain";

export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 250;

export function clampWeight(kg: number): number {
  const rounded = Math.round(kg * 2) / 2; // 0.5 kg steps
  return Math.min(WEIGHT_MAX_KG, Math.max(WEIGHT_MIN_KG, rounded));
}

// A sensible starting goal for each direction: 5 kg either way, or the
// current weight for maintenance. The member adjusts from there.
export function defaultGoalWeight(direction: GoalDirection, currentKg: number): number {
  if (direction === "lose") return clampWeight(currentKg - 5);
  if (direction === "gain") return clampWeight(currentKg + 5);
  return clampWeight(currentKg);
}

// "6.5 kg to lose" / "4 kg to gain" / "Hold steady at 80 kg".
export function goalGapLabel(currentKg: number, goalKg: number): string {
  const diff = Math.round((goalKg - currentKg) * 10) / 10;
  if (diff === 0) return `Hold steady at ${formatKg(goalKg)} kg`;
  return `${formatKg(Math.abs(diff))} kg to ${diff > 0 ? "gain" : "lose"}`;
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

// Direction implied by a goal weight, used when the member nudges the goal
// past their current weight after picking a direction.
export function directionFor(currentKg: number, goalKg: number): GoalDirection {
  if (goalKg < currentKg) return "lose";
  if (goalKg > currentKg) return "gain";
  return "maintain";
}
