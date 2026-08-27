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

// Mode a coach has set for a member's target — "auto" (the default for
// everyone) computes fresh from weight/training data; "manual" is the
// coach's own numbers; "disabled" shows nothing. Mirrors
// NutritionTargetMode in the main repo's lib/db.ts.
export type NutritionTargetMode = "auto" | "manual" | "disabled";

// The raw staff-set record — what the staff editor reads/writes.
export interface NutritionTarget {
  id: string;
  userId: string;
  mode: NutritionTargetMode;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  setByStaffId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// What the member (and the Day/Week screens) actually see — the resolved
// effective target for one date, mirrors ResolvedNutritionTarget in the
// main repo's lib/nutrition-target-data.ts. calories/macros are null only
// when mode is "disabled" or there's no weight on file yet to compute from.
export interface ResolvedNutritionTarget {
  date: string;
  mode: NutritionTargetMode;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fuelDay: string | null;
  fuelDayLabel: string | null;
  source: "adaptive" | "estimated" | "manual" | null;
  notes: string | null;
  bodyWeightKg: number | null;
  /** Member-facing "why this number" lines — see lib/nutrition-target.ts's
      buildTargetRationale in the main repo. Null when there's nothing to
      explain (disabled/no weight on file). */
  rationale: string[] | null;
  /** True when mode is "manual" and the member set it themselves (via the
      AI Nutrition Coach's "Apply this target"), not a coach. Always false
      for auto/disabled. Mirrors ResolvedNutritionTarget in the main repo's
      lib/nutrition-target-data.ts. */
  setByMember: boolean;
}

export interface ResolvedNutritionWeek {
  weekStart: string;
  days: ResolvedNutritionTarget[];
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

export function useMyNutritionTarget(date?: string) {
  return useQuery({
    queryKey: ["my-nutrition-target", date ?? "today"],
    queryFn: () =>
      apiFetch<{ success: true; data: ResolvedNutritionTarget | null }>(
        `/api/mobile/nutrition/target${date ? `?date=${encodeURIComponent(date)}` : ""}`
      ).then((r) => r.data),
  });
}

// The Mon-Sun week containing `date` (defaults to the week containing today).
export function useWeeklyNutritionTargets(date?: string) {
  return useQuery({
    queryKey: ["weekly-nutrition-targets", date ?? "this-week"],
    queryFn: () =>
      apiFetch<{ success: true; data: ResolvedNutritionWeek | null }>(
        `/api/mobile/nutrition/targets/week${date ? `?date=${encodeURIComponent(date)}` : ""}`
      ).then((r) => r.data),
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
  foodId?: string | null;
  foodDomain?: "custom" | "common" | "branded" | null;
  servingLabel?: string | null;
  servingGrams?: number | null;
  quantity?: number | null;
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

// Target is 1ml water per kcal in the member's daily calorie target — the
// same number shown at the top of this screen. null target means there
// isn't enough data yet (no weight on file, cold start, etc), or the
// coach has disabled daily targets.
export interface HydrationData {
  date: string;
  targetMl: number | null;
  loggedMl: number;
}

export function useHydration(date: string) {
  return useQuery({
    queryKey: ["hydration", date],
    queryFn: () => apiFetch<{ success: true; data: HydrationData }>(`/api/mobile/hydration?date=${encodeURIComponent(date)}`).then((r) => r.data),
  });
}

// Pass deltaMl to add (quick-add chips) or setMl to overwrite the day's
// total outright (the manual-entry fix for an accidental double-tap).
export function useLogWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string } & ({ deltaMl: number; setMl?: never } | { setMl: number; deltaMl?: never })) =>
      apiFetch<{ success: true; data: { date: string; loggedMl: number } }>("/api/mobile/hydration", {
        method: "POST",
        body: input,
      }),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["hydration", vars.date] }),
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
  mode: NutritionTargetMode;
  // Required when mode is "manual"; ignored (sent or not) otherwise.
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
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
