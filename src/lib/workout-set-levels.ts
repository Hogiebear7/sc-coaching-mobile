import type { ExerciseSection, WorkoutSessionSummary } from "@/lib/queries/workouts";
import { computeExerciseSetTotals } from "@/lib/workout-formatters";

// Port of gym-app's lib/workouts.ts computeMuscleSetLevels — same
// weekly-average-sets-per-muscle-group algorithm, over sessions/exercise
// library data mobile already has via useWorkouts(), so no new backend
// endpoint is needed.
//
// Also totals each group's volume (weight x reps, in kg) and its share of the total across the five groups, so the screen can say "quads-type work was 20% of
// everything you lifted". The shares always add up to 100% (or 0 when nothing with a weight was logged). "All time" is windowDays = null.

export type StrengthSection = Exclude<ExerciseSection, "cardio">;

export const SET_LEVEL_SECTIONS: StrengthSection[] = ["upper_push", "upper_pull", "lower_push", "lower_pull", "core"];

function isStrengthSection(section: ExerciseSection): section is StrengthSection {
  return section !== "cardio";
}

export type SetLevelTier = "none" | "low" | "moderate" | "high";

export interface MuscleSetLevel {
  section: StrengthSection;
  weeklySets: number;
  tier: SetLevelTier;
  /** All sets in the window, not the weekly average. */
  totalSets: number;
  /** Total weight x reps in the window, in kg (rounded). Bodyweight-only sets add nothing. */
  volumeKg: number;
  /** This group's share of the volume across all five groups, 0 to 100, rounded to a whole number. */
  volumeSharePct: number;
}

export interface MuscleSetLevelsResult {
  levels: Record<StrengthSection, MuscleSetLevel>;
  sessionsInWindow: number;
  resolvedSessions: number;
  /** Volume across the five groups, the figure the shares are of. */
  totalVolumeKg: number;
}

function tierForWeeklySets(weeklySets: number): SetLevelTier {
  if (weeklySets >= 15) return "high";
  if (weeklySets >= 7) return "moderate";
  if (weeklySets >= 1) return "low";
  return "none";
}

/** Shares that add up to exactly 100 (largest remainder), or all zeros when there is no volume. */
export function volumeShares(volumes: number[]): number[] {
  const total = volumes.reduce((a, b) => a + b, 0);
  if (total <= 0) return volumes.map(() => 0);
  const exact = volumes.map((v) => (v / total) * 100);
  const floors = exact.map((x) => Math.floor(x));
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remaining <= 0) break;
    if (volumes[i] > 0) {
      floors[i] += 1;
      remaining -= 1;
    }
  }
  return floors;
}

function daysBetweenInclusive(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00Z`).getTime();
  const b = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

// Free-text entries (exerciseId null, or an id the library no longer has)
// are honestly excluded rather than guessed — same rule as the History
// muscle-map icon. windowDays should be a multiple of 7, or null for all time
// (from the first logged session to today; the weekly average never divides by less than one week).
export function computeMuscleSetLevels(
  sessions: WorkoutSessionSummary[],
  sectionByExerciseId: Map<string, ExerciseSection>,
  windowDays: number | null,
  todayISO: string
): MuscleSetLevelsResult {
  let effectiveDays: number;
  let startISO: string;
  if (windowDays === null) {
    const dates = sessions.map((s) => s.date).filter((d) => d <= todayISO);
    startISO = dates.length > 0 ? dates.reduce((min, d) => (d < min ? d : min)) : todayISO;
    effectiveDays = Math.max(7, daysBetweenInclusive(startISO, todayISO));
  } else {
    const start = new Date(`${todayISO}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (windowDays - 1));
    startISO = start.toISOString().slice(0, 10);
    effectiveDays = windowDays;
  }

  const setTotals = Object.fromEntries(SET_LEVEL_SECTIONS.map((s) => [s, 0])) as Record<StrengthSection, number>;
  const volumeTotals = Object.fromEntries(SET_LEVEL_SECTIONS.map((s) => [s, 0])) as Record<StrengthSection, number>;

  let sessionsInWindow = 0;
  let resolvedSessions = 0;

  for (const session of sessions) {
    if (session.date < startISO || session.date > todayISO) continue;
    sessionsInWindow += 1;

    let resolvedAny = false;
    for (const ex of session.exercises) {
      const section = ex.exerciseId ? sectionByExerciseId.get(ex.exerciseId) : undefined;
      if (!section || !isStrengthSection(section)) continue;

      const setCount = ex.setDetails && ex.setDetails.length > 0 ? ex.setDetails.length : (ex.sets ?? 0);
      if (setCount <= 0) continue;

      setTotals[section] += setCount;
      volumeTotals[section] += computeExerciseSetTotals(ex).volume;
      resolvedAny = true;
    }
    if (resolvedAny) resolvedSessions += 1;
  }

  const weeks = effectiveDays / 7;
  const volumes = SET_LEVEL_SECTIONS.map((s) => Math.round(volumeTotals[s]));
  const shares = volumeShares(volumes);
  const levels = Object.fromEntries(
    SET_LEVEL_SECTIONS.map((section, i) => {
      const weeklySets = Math.round((setTotals[section] / weeks) * 10) / 10;
      const level: MuscleSetLevel = {
        section,
        weeklySets,
        tier: tierForWeeklySets(weeklySets),
        totalSets: setTotals[section],
        volumeKg: volumes[i],
        volumeSharePct: shares[i],
      };
      return [section, level];
    })
  ) as Record<StrengthSection, MuscleSetLevel>;

  return { levels, sessionsInWindow, resolvedSessions, totalVolumeKg: volumes.reduce((a, b) => a + b, 0) };
}
