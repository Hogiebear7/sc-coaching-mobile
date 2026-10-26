import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors lib/pregnancy.ts in the main repo.
export type Trimester = 1 | 2 | 3 | "postpartum";

export interface TrimesterContent {
  label: string;
  summary: string;
  trainingDo: string[];
  trainingAvoid: string[];
  nutritionDo: string[];
  nutritionAvoid: string[];
  recoveryDo: string[];
}

export interface PregnancyEstimate {
  isPregnant: boolean;
  weeksPregnant: number | null;
  trimester: Trimester | null;
  dueDate: string | null;
  content: TrimesterContent | null;
  disclaimer: string;
}

// Mirrors lib/pregnancy-training.ts's TrainingGuidance.
export interface TrainingGuidance {
  headline: string;
  effort: string;
  points: string[];
}

export interface PregnancyData {
  isPregnant: boolean;
  shareWithCoach: boolean;
  /** Set by "Baby has arrived". Optional: older servers don't send it. */
  birthDate?: string | null;
  breastfeeding?: boolean | null;
  estimate: PregnancyEstimate;
  /** Stage training guidance (pregnancy and the 12 weeks after the birth). */
  training?: TrainingGuidance | null;
}

interface PregnancyResponse {
  success: true;
  data: PregnancyData;
}

export function usePregnancyData(enabled: boolean) {
  return useQuery({
    queryKey: ["pregnancy"],
    queryFn: () => apiFetch<PregnancyResponse>("/api/mobile/pregnancy").then((r) => r.data),
    enabled,
  });
}

export interface PregnancyStatusInput {
  isPregnant: boolean;
  weeksAlong?: number;
  shareWithCoach?: boolean;
  birthDate?: string | null;
  breastfeeding?: boolean;
}

export function useSavePregnancyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PregnancyStatusInput) =>
      apiFetch<{ success: true; data: PregnancyData & { goalPaused?: boolean } }>("/api/pregnancy/status", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      // Pregnancy changes the calorie target, the cycle phase and training
      // guidance, so refresh everything rather than guess which screens.
      qc.invalidateQueries();
    },
  });
}
