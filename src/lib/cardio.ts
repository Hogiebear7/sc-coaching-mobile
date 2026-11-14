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

/** The stair climber counts floors, not kilometres. The number is kept in the same distance field. */
export function usesFloors(type: CardioType | undefined): boolean {
  return type === "stair_climber";
}

/** "0.4 km", "400 m" or "12 floors". Distances are kept in km, so a small one reads better in metres. */
export function formatCardioDistance(type: CardioType | undefined, distance: number): string {
  if (usesFloors(type)) return `${distance} ${distance === 1 ? "floor" : "floors"}`;
  return `${distance} km`;
}

/**
 * One cardio entry in words. A cardio line in a superset is done every round, so `sets` is how many rounds it was done for:
 * each round has the same distance and time, and the totals are those times the rounds.
 */
export function describeCardio(entry: { cardioType?: CardioType; distance: number | null; durationSecs: number | null; sets: number | null }): {
  perSet: string;
  rounds: number;
  total: string | null;
} {
  const type = entry.cardioType ?? "run";
  const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;
  const rounds = entry.sets && entry.sets > 1 ? entry.sets : 1;
  const per = [
    entry.distance !== null && entry.distance > 0 ? formatCardioDistance(type, entry.distance) : "",
    entry.durationSecs !== null && entry.durationSecs > 0 ? clock(entry.durationSecs) : "",
  ].filter(Boolean);
  if (rounds === 1 && hasPace(type) && entry.distance && entry.distance > 0 && entry.durationSecs && entry.durationSecs > 0) {
    const pace = Math.round(entry.durationSecs / entry.distance);
    per.push(`${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")} /km`);
  }
  const total =
    rounds > 1
      ? [
          entry.distance !== null && entry.distance > 0 ? formatCardioDistance(type, Math.round(entry.distance * rounds * 100) / 100) : "",
          entry.durationSecs !== null && entry.durationSecs > 0 ? clock(entry.durationSecs * rounds) : "",
        ]
          .filter(Boolean)
          .join(" · ") || null
      : null;
  return { perSet: per.join(" · "), rounds, total };
}
