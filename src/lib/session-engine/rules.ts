// Safety and suitability rules, kept in one place so they are easy to read and audit. These are conservative rules of thumb, NOT medical advice: the
// owner (and a qualified coach or physio) should review them, and the audit sheet's per-exercise pregnancy column overrides them.

import type { ExerciseFlags, InjuryArea, Level, PregnancyStage } from "./types";

const LEVEL_ORDER: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** The hardest level the member can be given: their own, capped by pregnancy. */
export function effectiveLevel(level: Level, pregnancy: PregnancyStage | null): Level {
  if (!pregnancy) return level;
  // Second and third trimester: nothing above intermediate. First trimester: the member's own level.
  if (pregnancy !== "first" && LEVEL_ORDER[level] > LEVEL_ORDER.intermediate) return "intermediate";
  return level;
}

export function levelAllowed(exerciseLevel: Level, cap: Level): boolean {
  return LEVEL_ORDER[exerciseLevel] <= LEVEL_ORDER[cap];
}

/** Why an exercise is not allowed for pregnancy at this stage, or null if it is. The override column from the audit beats these rules. */
export function pregnancyBlock(f: ExerciseFlags, stage: PregnancyStage): string | null {
  if (f.pregnancy === "avoid") return "marked as not suitable in pregnancy";
  if (f.pregnancy === "ok") return null;
  if (f.impact >= 2) return "high-impact";
  if (stage !== "first") {
    if (f.supine) return "lying on the back";
    if (f.prone) return "lying face down";
    if (f.coreFlexion) return "crunch or sit-up style core work";
    if (f.twisting) return "twisting or side-bending";
    if (f.balance && f.hardness >= 4) return "demanding single-leg balance";
  }
  if (stage === "third") {
    if (f.impact >= 1) return "impact";
    if (f.balance) return "single-leg balance";
    if (f.spineLoaded && f.hardness >= 4) return "heavy spine-loaded lifting";
  }
  return null;
}

export function injuryBlock(f: ExerciseFlags, injuries: InjuryArea[]): InjuryArea | null {
  return injuries.find((area) => f.avoidFor.includes(area)) ?? null;
}

/** The highest RPE (effort out of 10) the session should ask for. */
export function rpeCap(pregnancy: PregnancyStage | null, lowEnergy: boolean, reduced: boolean): number {
  let cap = 9;
  if (pregnancy === "first") cap = 8;
  if (pregnancy === "second") cap = 7;
  if (pregnancy === "third") cap = 6;
  if (lowEnergy || reduced) cap = Math.min(cap, 7);
  return cap;
}
