import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors WorkoutsData in the main repo's lib/workouts-data.ts.
export interface WorkoutSessionSummary {
  id: string;
  date: string;
  title: string;
  durationMins: number | null;
  notes: string | null;
  exerciseCount: number;
  exerciseNames: string[];
}

export interface PersonalBest {
  exerciseName: string;
  heaviestWeight: { weightStr: string; value: number; date: string; reps: number | null } | null;
  highestReps: { reps: number; date: string } | null;
}

export interface WorkoutsData {
  sessions: WorkoutSessionSummary[];
  personalBests: PersonalBest[];
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
