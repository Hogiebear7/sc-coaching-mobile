import type { ExerciseSection, WorkoutSessionSummary } from "@/lib/queries/workouts";

// Port of gym-app's lib/workouts.ts computeMuscleSetLevels — same
// weekly-average-sets-per-muscle-group algorithm, over sessions/exercise
// library data mobile already has via useWorkouts(), so no new backend
// endpoint is needed.

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
}

export interface MuscleSetLevelsResult {
  levels: Record<StrengthSection, MuscleSetLevel>;
  sessionsInWindow: number;
  resolvedSessions: number;
}

function tierForWeeklySets(weeklySets: number): SetLevelTier {
  if (weeklySets >= 15) return "high";
  if (weeklySets >= 7) return "moderate";
  if (weeklySets >= 1) return "low";
  return "none";
}

// Free-text entries (exerciseId null, or an id the library no longer has)
// are honestly excluded rather than guessed — same rule as the History
// muscle-map icon. windowDays should be a multiple of 7.
export function computeMuscleSetLevels(
  sessions: WorkoutSessionSummary[],
  sectionByExerciseId: Map<string, ExerciseSection>,
  windowDays: number,
  todayISO: string
): MuscleSetLevelsResult {
  const start = new Date(`${todayISO}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));
  const startISO = start.toISOString().slice(0, 10);

  const totals = Object.fromEntries(SET_LEVEL_SECTIONS.map((s) => [s, 0])) as Record<StrengthSection, number>;

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

      totals[section] += setCount;
      resolvedAny = true;
    }
    if (resolvedAny) resolvedSessions += 1;
  }

  const weeks = windowDays / 7;
  const levels = Object.fromEntries(
    SET_LEVEL_SECTIONS.map((section) => {
      const weeklySets = Math.round((totals[section] / weeks) * 10) / 10;
      const level: MuscleSetLevel = { section, weeklySets, tier: tierForWeeklySets(weeklySets) };
      return [section, level];
    })
  ) as Record<StrengthSection, MuscleSetLevel>;

  return { levels, sessionsInWindow, resolvedSessions };
}
