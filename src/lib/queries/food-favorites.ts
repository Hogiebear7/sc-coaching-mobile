import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { MealType } from "@/lib/queries/nutrition-diary";

// Mirrors FoodFavoriteRecord in the main repo's lib/db.ts — a member's own
// curated shortlist of regularly-eaten foods, organized by meal. Separate
// from the auto-populated "recent" shelf: this is a deliberate save action,
// and (like a recent entry) a flat nutrition snapshot at save time rather
// than a live reference back to the food catalog.
export interface FoodFavorite {
  id: string;
  userId: string;
  mealType: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingLabel: string | null;
  servingGrams: number | null;
  createdAt: string;
}

export interface FoodFavoriteAddInput {
  mealType: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingLabel?: string | null;
  servingGrams?: number | null;
}

export function useFoodFavorites() {
  return useQuery({
    queryKey: ["food-favorites"],
    queryFn: () => apiFetch<{ success: true; data: FoodFavorite[] }>("/api/mobile/nutrition/food/favorites").then((r) => r.data),
  });
}

export function useAddFoodFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodFavoriteAddInput) =>
      apiFetch<{ success: true; data: FoodFavorite }>("/api/mobile/nutrition/food/favorites/add", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-favorites"] }),
  });
}

export function useRemoveFoodFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>("/api/mobile/nutrition/food/favorites/delete", { method: "POST", body: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-favorites"] }),
  });
}
