import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors WorkoutSetType in the main repo's lib/db.ts.
export type WorkoutSetType = "standard" | "warmup" | "dropset" | "myoset" | "failure" | "partial";

export const SET_TYPE_OPTIONS: { value: WorkoutSetType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "warmup", label: "Warm-up" },
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
  // Per-side reps for a unilateral set (perSide true on the parent
  // exercise) — reps is null when these are used, and vice versa.
  repsRight?: number | null;
  repsLeft?: number | null;
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
  perSide?: boolean | null;
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
  /** Set when synced from a class — edited via useUpdateClassWorkout
      (exercises/notes only), not the general self-logged edit flow. */
  classId: string | null;
}

export interface PersonalBest {
  exerciseName: string;
  heaviestWeight: { weightStr: string; value: number; date: string; reps: number | null } | null;
  highestReps: { reps: number; date: string } | null;
}

// Mirrors gym-app's lib/db.ts ExerciseSection — the coach's curated
// exercise list, distinct from the big imported exercise-library used for
// demo thumbnails (see lib/queries/exercise-library.ts).
export type ExerciseSection = "upper_push" | "upper_pull" | "lower_push" | "lower_pull" | "core" | "cardio";

export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  section: ExerciseSection;
}

export interface WorkoutsData {
  sessions: WorkoutSessionSummary[];
  personalBests: PersonalBest[];
  exerciseLibrary: ExerciseLibraryEntry[];
  pinnedExercises: string[];
  pinnedProgressionExercises: string[];
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
  perSide: boolean;
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
  /** Overall session RPE (1-10) from the post-workout "How did that feel?"
      prompt — separate from any per-exercise rir/rpe already on the rows.
      Feeds the workout review and, eventually, the AI report. */
  sessionRpe?: number | null;
  feelingNotes?: string;
  exercises: CreateWorkoutExerciseInput[];
  runs: CreateWorkoutRunInput[];
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkoutInput) =>
      apiFetch<{ success: true; message: string; id: string }>("/api/workouts/create", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export interface EditWorkoutInput extends CreateWorkoutInput {
  id: string;
}

// Self-logged sessions only — class-synced ones use their own correction
// path, not this endpoint (see app/api/workouts/edit/route.ts).
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

export interface UpdateClassWorkoutInput {
  sessionId: string;
  exercises: CreateWorkoutExerciseInput[];
  notes: string;
}

// Class-synced sessions only — corrects exercises/notes on a workout that
// was auto-added from a booked class (see app/api/workouts/update/route.ts).
// No date/title/duration here; those come from the class itself.
export function useUpdateClassWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClassWorkoutInput) =>
      apiFetch<{ success: true; message: string }>("/api/workouts/update", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

// Works for either a self-logged or class-synced session — the member owns
// the record either way (see app/api/workouts/delete/route.ts).
export function useDeleteWorkoutSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true; message: string }>("/api/workouts/delete", {
        method: "POST",
        body: { id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

// Mirrors WorkoutReviewData / SessionComparison / NutritionCompliance in the
// main repo's lib/workout-review.ts.
export interface WorkoutReviewComparison {
  thisVolume: number;
  thisDurationMins: number | null;
  thisRpe: number | null;
  recentAvgVolume: number | null;
  recentAvgRpe: number | null;
  recentAvgDurationMins: number | null;
  comparedSessionCount: number;
}

export interface WorkoutReviewRecovery {
  sleepHours: number | null;
  sleepQuality: number | null;
  soreness: number | null;
  fatigue: number | null;
  readinessScore: number | null;
}

export interface WorkoutReviewCyclePhase {
  phase: string;
  phaseLabel: string;
  cycleDay: number | null;
  cycleLength: number | null;
  confidence: "standard" | "low";
}

export interface WorkoutReviewNutrition {
  logged: boolean;
  targetCalories: number | null;
  targetProteinG: number | null;
  actualCalories: number | null;
  actualProteinG: number | null;
}

export interface WorkoutReviewHydration {
  targetMl: number | null;
  loggedMl: number;
}

export interface WorkoutReviewPregnancy {
  weeksPregnant: number | null;
  content: { label: string; summary: string } | null;
}

export interface WorkoutScoreComponent {
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

// Mirrors WorkoutScoreBreakdown in lib/workout-score.ts. Only present when
// the server-side WORKOUT_SCORE_ENABLED flag is on — absent (not zero)
// otherwise, so the UI below renders nothing rather than a misleading 0.
export interface WorkoutScoreBreakdown {
  total: number;
  band: "excellent" | "solid" | "fair" | "low";
  components: WorkoutScoreComponent[];
}

export interface WorkoutReviewData {
  comparison: WorkoutReviewComparison;
  recovery: WorkoutReviewRecovery | null;
  cyclePhase: WorkoutReviewCyclePhase | null;
  pregnancy: WorkoutReviewPregnancy | null;
  nutrition: WorkoutReviewNutrition | null;
  hydration: WorkoutReviewHydration | null;
  reviewText: string;
  score?: WorkoutScoreBreakdown;
}

// Generated once server-side and cached on the session record — safe to
// leave the default staleTime, this won't change between refetches.
export function useWorkoutReview(id: string | null) {
  return useQuery({
    queryKey: ["workout-review", id],
    queryFn: () => apiFetch<{ success: true; data: WorkoutReviewData }>(`/api/mobile/workout-review/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// Up to 5 exercise names the member curates for their Personal Bests card
// (see app/api/profile/pinned-exercises/route.ts, which normalizes/caps
// server-side regardless of what's sent here).
export function useUpdatePinnedExercises() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pinnedExercises: string[]) =>
      apiFetch<{ success: true; pinnedExercises: string[] }>("/api/profile/pinned-exercises", {
        method: "POST",
        body: { pinnedExercises },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
