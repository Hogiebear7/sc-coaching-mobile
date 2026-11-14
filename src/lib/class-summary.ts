import type { WorkoutSummaryData } from "@/app/workout-summary";
import { formatExerciseLoad } from "@/lib/workout-formatters";
import type { CreateWorkoutExerciseInput, PersonalBest } from "@/lib/queries/workouts";

// The "how did that go" summary for a class workout, shown after the member has checked their workout and said how it felt. The same screen
// a self-logged workout ends on. A class is finished by the time this is opened, so every set counts as done.

function repsPerSet(set: { reps: number | null; repsRight?: number | null; repsLeft?: number | null }): number | null {
  if (set.reps != null) return set.reps;
  if (set.repsRight != null || set.repsLeft != null) return (set.repsRight ?? 0) + (set.repsLeft ?? 0);
  return null;
}

export function buildClassWorkoutSummary(
  session: { id: string; title: string; date: string; durationMins: number | null },
  exercises: CreateWorkoutExerciseInput[],
  personalBests: PersonalBest[]
): WorkoutSummaryData {
  let totalVolume = 0;
  let totalSets = 0;

  const summaries = exercises.map((ex) => {
    const sets =
      ex.setDetails && ex.setDetails.length > 0
        ? ex.setDetails.map((s) => ({ weight: s.weight, reps: repsPerSet(s) }))
        : Array.from({ length: ex.sets ?? 0 }, () => ({ weight: ex.weight, reps: ex.reps }));
    let heaviest = 0;
    for (const s of sets) {
      const w = s.weight ? parseFloat(s.weight) : NaN;
      if (Number.isFinite(w) && w > heaviest) heaviest = w;
      if (Number.isFinite(w) && s.reps != null) totalVolume += w * s.reps;
    }
    totalSets += sets.length;
    const pb = personalBests.find((p) => p.exerciseName.toLowerCase() === ex.name.trim().toLowerCase());
    const isPb = heaviest > 0 && (!pb?.heaviestWeight || heaviest > pb.heaviestWeight.value);
    return {
      name: ex.name.trim(),
      setsLogged: sets.length,
      setsCompleted: sets.length,
      summary: formatExerciseLoad({ ...ex, name: ex.name.trim(), notes: null }),
      isPb,
    };
  });

  return {
    id: session.id,
    title: session.title,
    date: session.date,
    durationLabel: session.durationMins ? `${session.durationMins} min` : "—",
    totalVolume: Math.round(totalVolume),
    totalSets,
    completedSets: totalSets,
    totalExercises: exercises.length,
    completedExercises: exercises.length,
    exercises: summaries,
  };
}
