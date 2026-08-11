// Standard gym plate sets, heaviest first — greedy-fill works because every
// standard set is a "canonical coin system" (each denomination divides
// evenly enough that greedy always finds the closest reachable total).
export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] as const;
export const LB_PLATES = [45, 35, 25, 10, 5, 2.5] as const;

export const BAR_PRESETS_KG = [
  { label: "Olympic 20kg", value: 20 },
  { label: "Women's 15kg", value: 15 },
  { label: "Technique 10kg", value: 10 },
  { label: "Trap bar 25kg", value: 25 },
  { label: "Safety squat 20kg", value: 20 },
  { label: "EZ curl 10kg", value: 10 },
];
export const BAR_PRESETS_LB = [
  { label: "Olympic 45lb", value: 45 },
  { label: "Women's 35lb", value: 35 },
  { label: "Technique 15lb", value: 15 },
  { label: "Trap bar 55lb", value: 55 },
  { label: "Safety squat 45lb", value: 45 },
  { label: "EZ curl 20lb", value: 20 },
];

export interface PlateLoadResult {
  /** One entry per plate size used on EACH side, largest first. */
  perSide: { plate: number; count: number }[];
  /** Actual achievable total (bar + both sides) — may differ from the
      target if it isn't exactly reachable with the given plates. */
  achievableTotal: number;
  /** target - achievableTotal. Zero when the target is exactly reachable. */
  shortfall: number;
}

// Greedy per-side fill: at each denomination, use as many as fit without
// exceeding the remaining half-weight. Standard gym plate sets are exact
// enough that greedy always reaches the closest achievable total.
export function calculatePlateLoad(
  targetTotal: number,
  barWeight: number,
  availablePlates: readonly number[]
): PlateLoadResult {
  const perSideTarget = Math.max(0, (targetTotal - barWeight) / 2);
  let remaining = perSideTarget;
  const perSide: { plate: number; count: number }[] = [];

  for (const plate of [...availablePlates].sort((a, b) => b - a)) {
    if (plate <= 0) continue;
    const count = Math.floor(remaining / plate + 1e-9);
    if (count > 0) {
      perSide.push({ plate, count });
      remaining -= count * plate;
    }
  }

  const achievableTotal = barWeight + perSide.reduce((sum, p) => sum + p.plate * p.count, 0) * 2;

  return {
    perSide,
    achievableTotal: Math.round(achievableTotal * 100) / 100,
    shortfall: Math.round((targetTotal - achievableTotal) * 100) / 100,
  };
}
