import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors lib/body-composition-goal.ts's GoalTimelineResult in the main
// repo — a pure math type, safe to duplicate here since there's no shared
// package between the two repos (same convention as every other
// web/mobile-mirrored type in this app).
export type GoalDirection = "lose" | "gain" | "maintain";
export type GoalDifficulty = "comfortable" | "challenging" | "aggressive";

export interface GoalTimelineResult {
  direction: GoalDirection;
  daysToTarget: number | null;
  requiredWeeklyRate: number | null;
  clampedWeeklyRate: number | null;
  isAggressive: boolean;
  projectedDateAtCurrentTrend: string | null;
  sustainableWeeklyRate: number | null;
  suggestedDate: string | null;
  difficulty: GoalDifficulty | null;
}

export interface GoalTimelineData {
  goalWeightKg: number | null;
  goalBodyFatPct: number | null;
  goalTargetDate: string | null;
  trainingDaysPerWeek: number | null;
  currentWeightKg: number | null;
  currentBodyFatPct: number | null;
  weightTimeline: GoalTimelineResult | null;
  bodyFatTimeline: GoalTimelineResult | null;
}

export function useGoalTimeline() {
  return useQuery({
    queryKey: ["goal-timeline"],
    queryFn: () => apiFetch<{ success: true; data: GoalTimelineData }>("/api/profile/goal-timeline").then((r) => r.data),
  });
}

export interface SaveGoalInput {
  goalWeightKg?: number | null;
  goalBodyFatPct?: number | null;
  goalTargetDate?: string | null;
  trainingDaysPerWeek?: number | null;
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveGoalInput) =>
      apiFetch<{ success: true; message: string }>("/api/profile/goal", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goal-timeline"] }),
  });
}
