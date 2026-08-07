import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiFetchText } from "@/lib/api-client";

// Mirrors NutritionData in the main repo's lib/nutrition-data.ts.
export interface FoodItem {
  name: string;
  group: "protein" | "carb" | "snack";
  animal: "meat" | "fish" | "animal_product" | "none";
  allergens: string[];
}

export interface NutritionAiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface NutritionData {
  bodyWeightKg: number | null;
  goalBias: "maintain" | "lose" | "gain";
  primaryGoal: string;
  yesterdayExertion: "low" | "medium" | "high";
  todayExertion: "low" | "medium" | "high";
  readinessScore: number | null;
  sevenDayLoad: number;
  daysWithLoad: number;
  lastSessionTitle: string | null;
  lastSessionDate: string | null;
  foodRecommendations: { protein: FoodItem[]; carb: FoodItem[]; snack: FoodItem[] };
  dietarySummary: { preferenceLabel: string; exclusions: string[] };
  aiNutritionCoachConfigured: boolean;
  initialAiNutritionMessages: NutritionAiMessage[];
  nextSession: { title: string; date: string; category: string } | null;
}

interface NutritionResponse {
  success: true;
  data: NutritionData;
}

export function useNutrition() {
  return useQuery({
    queryKey: ["nutrition"],
    queryFn: () => apiFetch<NutritionResponse>("/api/mobile/nutrition").then((r) => r.data),
  });
}

export function useSendNutritionCoachMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiFetchText("/api/ai/nutrition-coach", { body: { content, tomorrow: "medium" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition"] }),
  });
}
