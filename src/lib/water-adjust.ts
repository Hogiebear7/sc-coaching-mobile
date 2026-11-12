// Maths for adjusting the day's water by dragging (the bottle, or the dial beside it). Kept apart from the screen so it can be tested.
//
// A drag produces a "pending" change, in millilitres of the drink that is picked (Water, Tea, ...). Nothing is saved while the finger moves
// or when it lifts. The change is saved when the member taps anywhere else, and goes to the server as the day's new total, because the
// server only takes a positive amount to add but takes any total from 0 to 10,000 ml.

export const WATER_STEP_ML = 50;
export const WATER_MAX_ML = 10_000;
/** How far a finger travels on the dial for one 50 ml step. */
export const DIAL_PX_PER_STEP = 12;
/** Used to map a drag on the bottle when the day has no target to fill towards. */
export const FALLBACK_GOAL_ML = 2700;

export function snapToStep(ml: number): number {
  return Math.round(ml / WATER_STEP_ML) * WATER_STEP_ML;
}

/** Dragging the water surface up adds. The surface follows the finger one to one: a drag the height of the bottle is the whole goal. */
export function bottleDeltaFromDrag(dyPx: number, bodyHeightPx: number, goalMl: number): number {
  if (!(bodyHeightPx > 0) || !(goalMl > 0)) return 0;
  return snapToStep((-dyPx / bodyHeightPx) * goalMl);
}

/** Dragging the dial down adds, up takes away (the way the dial is drawn, with the numbers running down). */
export function dialDeltaFromDrag(dyPx: number): number {
  return Math.round(dyPx / DIAL_PX_PER_STEP) * WATER_STEP_ML;
}

/** What a pending amount of the picked drink is worth as water. */
export function waterEquivalent(pendingMl: number, share: number): number {
  return Math.round(pendingMl * share);
}

/** The day's total after the pending change, never below 0 or above the server's limit. */
export function totalAfter(loggedMl: number, pendingMl: number, share: number): number {
  return Math.max(0, Math.min(WATER_MAX_ML, loggedMl + waterEquivalent(pendingMl, share)));
}

/** Keeps a pending change inside what the day's total can take: it cannot take off more than has been logged or add past the limit. */
export function clampPending(pendingMl: number, loggedMl: number, share: number): number {
  const s = share > 0 ? share : 1;
  const lowest = Math.ceil(-loggedMl / s / WATER_STEP_ML) * WATER_STEP_ML;
  const highest = Math.floor((WATER_MAX_ML - loggedMl) / s / WATER_STEP_ML) * WATER_STEP_ML;
  return Math.max(lowest, Math.min(highest, pendingMl));
}

export function formatSignedMl(ml: number): string {
  if (ml === 0) return "0 ml";
  return `${ml > 0 ? "+" : "−"}${Math.abs(ml)} ml`;
}
