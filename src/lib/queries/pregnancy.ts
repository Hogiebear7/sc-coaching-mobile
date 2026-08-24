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

export interface PregnancyData {
  isPregnant: boolean;
  shareWithCoach: boolean;
  estimate: PregnancyEstimate;
}

interface PregnancyResponse {
  success: true;
  data: PregnancyData;
}

export const COACH_SHARE_UNLOCK_WEEKS = 12;

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
  shareWithCoach: boolean;
}

export function useSavePregnancyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PregnancyStatusInput) =>
      apiFetch<{ success: true; data: PregnancyData }>("/api/pregnancy/status", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pregnancy"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
