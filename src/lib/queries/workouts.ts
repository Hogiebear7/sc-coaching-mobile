import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors WorkoutSetType in the main repo's lib/db.ts.
export type WorkoutSetType = "standard" | "dropset" | "myoset" | "failure" | "partial";

export const SET_TYPE_OPTIONS: { value: WorkoutSetType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "dropset", label: "Dropset" },
  { value: "myoset", label: "Myoset" },
  { value: "failure", label: "Failure" },
  { value: "partial", label: "Partials" },
];

// Mirrors WorkoutExerciseEntry / WorkoutRunEntry in the main repo's lib/db.ts.
export interface WorkoutSetDetail {
  weight: string | null;
  reps: number | null;
  setType?: WorkoutSetType | null;
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
  setType?: WorkoutSetType | null;
  supersetGroup?: string | null;
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
  /** Set when synced from a class — those aren't editable from the general
      edit flow, only self-logged sessions are. */
  classId: string | null;
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
  setType: WorkoutSetType | null;
  supersetGroup: string | null;
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

export interface EditWorkoutInput extends CreateWorkoutInput {
  id: string;
}

// Self-logged sessions only — class-synced ones use their own same-day
// correction path, not this endpoint (see app/api/workouts/edit/route.ts).
export function useEditWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EditWorkoutInput) =>
      apiFetch<{ success: true; message: string }>("/api/workouts/edit", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
