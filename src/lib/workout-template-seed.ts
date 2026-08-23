import type { PrescribedExercise } from "@/lib/queries/programs";

// Same in-memory, read-once handoff pattern as workout-summary-handoff.ts —
// used to hand a just-logged workout's exercises to
// workout-template-builder.tsx ("Save as template") without routing a
// JSON-serialized array through navigation params.
export interface WorkoutTemplateSeed {
  name: string;
  exercises: PrescribedExercise[];
}

let pending: WorkoutTemplateSeed | null = null;

export function setPendingWorkoutTemplateSeed(seed: WorkoutTemplateSeed): void {
  pending = seed;
}

export function takePendingWorkoutTemplateSeed(): WorkoutTemplateSeed | null {
  const seed = pending;
  pending = null;
  return seed;
}
