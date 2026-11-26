import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors MealSuggestion in the main repo's lib/ai.ts.
export interface MealSuggestion {
  title: string;
  description: string;
  ingredientsUsed: string[];
  estimatedCalories: number;
  estimatedProteinG: number;
  estimatedCarbsG: number;
  estimatedFatG: number;
  /** Estimates like the rest. Absent or null when the server or model did not give one. */
  estimatedFiberG?: number | null;
  estimatedSugarG?: number | null;
  crossSuggestion: string | null;
}

export interface MealSuggestInput {
  imageBase64?: string | null;
  ingredientsText?: string | null;
}

interface MealSuggestResponse {
  success: true;
  configured: true;
  suggestions: MealSuggestion[];
}

export function useMealSuggest() {
  return useMutation({
    mutationFn: (input: MealSuggestInput) =>
      apiFetch<MealSuggestResponse>("/api/mobile/nutrition/meal-suggest", {
        method: "POST",
        body: input,
      }),
  });
}
