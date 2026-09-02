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
  /** Self-reported plan value, not a logged actual. Optional/nullable for
      pre-existing sessions (see normalizeSessions in the main repo's
      app/api/mobile/weekly-training/route.ts). */
  estimatedDurationMins?: number | null;
  notes: string | null;
  /** true = repeats every week. false = a one-off for this week only — the
      server drops it once the week is over, no action needed here. */
  recurring: boolean;
  /** Server-assigned; the client never sets this directly. */
  weekOf: string | null;
  /** Set only on a session auto-created from a class booking — server-owned
      and read-only here, same as weekOf. null for a session the member
      created themselves. */
  sourceBookingId: string | null;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weekly-training"] });
      // The weekly plan is a fallback input to the calorie/macro target for
      // any date without its own Recovery check-in — without this, editing
      // a session leaves the Nutrition tab showing a stale number until
      // something else happens to refetch it (see nutrition.ts's identical
      // invalidation for the same reason).
      qc.invalidateQueries({ queryKey: ["my-nutrition-target"] });
      qc.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });
      // Same reason — it's also an input to the Workout Helper's session
      // tier (today's planned/booked exertion).
      qc.invalidateQueries({ queryKey: ["workout-helper-tier"] });
    },
  });
}
