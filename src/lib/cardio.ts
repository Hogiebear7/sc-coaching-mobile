// Cardio pieces logged with a session ("Add cardio"). Mirrors gym-app's
// CARDIO_TYPES in lib/workout-entries.ts; older entries have no type and are
// runs.
export const CARDIO_TYPES = ["run", "walk", "treadmill_walk", "stair_climber", "bike", "rower", "cross_trainer", "other"] as const;
export type CardioType = (typeof CARDIO_TYPES)[number];

export const CARDIO_LABEL: Record<CardioType, string> = {
  run: "Run",
  walk: "Walk",
  treadmill_walk: "Treadmill walk",
  stair_climber: "Stair climber",
  bike: "Bike",
  rower: "Rower",
  cross_trainer: "Cross-trainer",
  other: "Other cardio",
};

/** Machines with a level or incline worth recording. */
export function hasLevel(type: CardioType): boolean {
  return type === "treadmill_walk" || type === "stair_climber" || type === "bike" || type === "rower" || type === "cross_trainer";
}

/** Distance and pace make sense for these. */
export function hasPace(type: CardioType): boolean {
  return type === "run" || type === "walk" || type === "treadmill_walk";
}

export function asCardioType(value: unknown): CardioType {
  return CARDIO_TYPES.includes(value as CardioType) ? (value as CardioType) : "run";
}

export function parseLevel(text: string): number | null {
  const n = parseFloat(text);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : null;
}
