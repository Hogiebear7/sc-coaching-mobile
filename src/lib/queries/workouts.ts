import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors WorkoutExerciseEntry / WorkoutRunEntry in the main repo's lib/db.ts.
export interface WorkoutSetDetail {
  weight: string | null;
  reps: number | null;
}

export interface WorkoutExerciseEntry {
  exerciseId: string | null;
  name: string;
  weight: string | null;
  reps: number | null;
  sets: number | null;
  rpe?: number | null;
  rir?: number | null;
  setDetails?: WorkoutSetDetail[] | null;
  notes: string | null;
}

export interface WorkoutRunEntry {
  distance: number | null;
  distanceUnit: "km";
  durationSecs: number | null;
  reps: number | null;
  sets: number | null;
  notes: string | null;
}

// Mirrors WorkoutsData in the main repo's lib/workouts-data.ts.
export interface WorkoutSessionSummary {
  id: string;
  date: string;
  title: string;
  durationMins: number | null;
  notes: string | null;
  exercises: WorkoutExerciseEntry[];
  runs: WorkoutRunEntry[];
}

export interface PersonalBest {
  exerciseName: string;
  heaviestWeight: { weightStr: string; value: number; date: string; reps: number | null } | null;
  highestReps: { reps: number; date: string } | null;
}

export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  section: string;
}

export interface WorkoutsData {
  sessions: WorkoutSessionSummary[];
  personalBests: PersonalBest[];
  exerciseLibrary: ExerciseLibraryEntry[];
}

interface WorkoutsResponse {
  success: true;
  data: WorkoutsData;
}

export function useWorkouts() {
  return useQuery({
    queryKey: ["workouts"],
    queryFn: () => apiFetch<WorkoutsResponse>("/api/mobile/workouts").then((r) => r.data),
  });
}

export interface CreateWorkoutExerciseInput {
  exerciseId: string | null;
  name: string;
  weight: string | null;
  reps: number | null;
  sets: number | null;
  rir: number | null;
  setDetails: WorkoutSetDetail[];
  notes: string | null;
}

export interface CreateWorkoutRunInput {
  distance: number | null;
  durationSecs: number | null;
  reps: number | null;
  sets: number | null;
  notes: string | null;
}

export interface CreateWorkoutInput {
  title: string;
  date: string;
  durationMins: string;
  notes: string;
  exercises: CreateWorkoutExerciseInput[];
  runs: CreateWorkoutRunInput[];
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkoutInput) =>
      apiFetch<{ success: true; message: string }>("/api/workouts/create", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
