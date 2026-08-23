import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors RecipeIngredientEntry/RecipeRecord in the main repo's lib/db.ts.
export interface RecipeIngredient {
  displayText: string;
  normalizedName: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  ingredients: RecipeIngredient[];
  notes: string | null;
  source: "meal-suggest" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecipeInput {
  title: string;
  ingredients: RecipeIngredient[];
  notes?: string | null;
  source: "meal-suggest" | "manual";
}

export function useRecipes() {
  return useQuery({
    queryKey: ["recipes"],
    queryFn: () => apiFetch<{ success: true; data: Recipe[] }>("/api/mobile/nutrition/recipes").then((r) => r.data),
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRecipeInput) =>
      apiFetch<{ success: true; message: string; data: Recipe }>("/api/mobile/nutrition/recipes/create", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>("/api/mobile/nutrition/recipes/delete", { method: "POST", body: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}
