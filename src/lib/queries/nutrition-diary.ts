import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors NutritionTargetRecord/FoodEntryRecord in the main repo's lib/db.ts.
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export interface NutritionTarget {
  id: string;
  userId: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  setByStaffId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodEntry {
  id: string;
  userId: string;
  date: string;
  mealType: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: string;
}

export interface DailyTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// ── Member-facing ────────────────────────────────────────────────────────

export function useMyNutritionTarget() {
  return useQuery({
    queryKey: ["my-nutrition-target"],
    queryFn: () => apiFetch<{ success: true; data: NutritionTarget | null }>("/api/mobile/nutrition/target").then((r) => r.data),
  });
}

export function useNutritionDiary(date: string) {
  return useQuery({
    queryKey: ["nutrition-diary", date],
    queryFn: () =>
      apiFetch<{ success: true; data: { entries: FoodEntry[]; totals: DailyTotals } }>(
        `/api/mobile/nutrition/diary?date=${encodeURIComponent(date)}`
      ).then((r) => r.data),
  });
}

export function useRecentFoods() {
  return useQuery({
    queryKey: ["nutrition-recent-foods"],
    queryFn: () => apiFetch<{ success: true; data: FoodEntry[] }>("/api/mobile/nutrition/diary/recent").then((r) => r.data),
  });
}

export interface FoodEntryInput {
  date: string;
  mealType: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function useCreateFoodEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodEntryInput) =>
      apiFetch<{ success: true; data: FoodEntry }>("/api/mobile/nutrition/diary/create", { method: "POST", body: input }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["nutrition-diary", vars.date] });
      qc.invalidateQueries({ queryKey: ["nutrition-recent-foods"] });
    },
  });
}

export function useDeleteFoodEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; date: string }) =>
      apiFetch<{ success: true }>("/api/mobile/nutrition/diary/delete", { method: "POST", body: { id } }),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["nutrition-diary", vars.date] }),
  });
}

// ── Staff-facing ─────────────────────────────────────────────────────────

export function useStaffNutritionTarget(userId: string | undefined) {
  return useQuery({
    queryKey: ["staff-nutrition-target", userId],
    queryFn: () =>
      apiFetch<{ success: true; data: NutritionTarget | null }>(
        `/api/mobile/staff/nutrition-target?userId=${encodeURIComponent(userId ?? "")}`
      ).then((r) => r.data),
    enabled: !!userId,
  });
}

export interface NutritionTargetInput {
  userId: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes?: string;
}

export function useUpdateStaffNutritionTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NutritionTargetInput) =>
      apiFetch<{ success: true; data: NutritionTarget }>("/api/mobile/staff/nutrition-target/update", {
        method: "POST",
        body: input,
      }),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["staff-nutrition-target", vars.userId] }),
  });
}
