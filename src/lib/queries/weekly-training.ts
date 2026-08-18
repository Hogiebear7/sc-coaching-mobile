import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors the types in the main repo's lib/profile-schema.ts.
export type TrainingDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // matches Date#getDay(), 0 = Sunday
export type TrainingActivityType = "gym" | "sport" | "cardio" | "rest" | "other";
export type TrainingTimeOfDay = "morning" | "afternoon" | "evening";
export type TrainingIntensity = "light" | "moderate" | "heavy";

export interface WeeklyTrainingSession {
  id: string;
  dayOfWeek: TrainingDayOfWeek;
  label: string;
  activityType: TrainingActivityType;
  timeOfDay: TrainingTimeOfDay | null;
  intensity: TrainingIntensity | null;
  notes: string | null;
  /** true = repeats every week. false = a one-off for this week only — the
      server drops it once the week is over, no action needed here. */
  recurring: boolean;
  /** Server-assigned; the client never sets this directly. */
  weekOf: string | null;
}

export interface WeeklyTrainingScheduleData {
  sessions: WeeklyTrainingSession[];
  updatedAt: string | null;
}

interface WeeklyTrainingResponse {
  success: true;
  data: WeeklyTrainingScheduleData;
}

export function useWeeklyTraining() {
  return useQuery({
    queryKey: ["weekly-training"],
    queryFn: () => apiFetch<WeeklyTrainingResponse>("/api/mobile/weekly-training").then((r) => r.data),
  });
}

// Full-replace, same semantics as the backend route — always send the
// complete session list, not a delta.
export function useUpdateWeeklyTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessions: WeeklyTrainingSession[]) =>
      apiFetch<WeeklyTrainingResponse>("/api/mobile/weekly-training", {
        method: "POST",
        body: { sessions },
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-training"] }),
  });
}
