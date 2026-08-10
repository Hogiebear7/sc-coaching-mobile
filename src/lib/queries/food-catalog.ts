import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors the FoodRecord family in the main repo's lib/db.ts — the single
// normalized schema shared by custom/common/branded foods.
export type FoodDomain = "custom" | "common" | "branded";
export type FoodProvenance = "user" | "open_food_facts" | "admin" | "usda_seed";

export interface FoodServing {
  label: string;
  grams: number;
}

export interface FoodNutrition100g {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  saturatedFatG: number | null;
}

export interface FoodRecord {
  id: string;
  domain: FoodDomain;
  name: string;
  brandName: string | null;
  barcode: string | null;
  nutrition100g: FoodNutrition100g;
  defaultServing: FoodServing;
  servings: FoodServing[];
  provenance: FoodProvenance;
  sourceRef: string | null;
  verified: boolean;
  region: string | null;
  ownerUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fetchedAt: string | null;
}

export interface FoodSearchGroups {
  history: FoodRecord[];
  custom: FoodRecord[];
  common: FoodRecord[];
  branded: FoodRecord[];
}

// Gram math — canonical nutrition is always per 100g; a serving is just a
// labelled gram conversion layered on top. Mirrors
// lib/food-catalog.ts's gramsForServing/nutritionForGrams exactly so the
// mobile preview matches what the server would compute.
export function gramsForServing(food: Pick<FoodRecord, "servings" | "defaultServing">, servingLabel: string | null, quantity: number): number {
  const serving = servingLabel ? (food.servings.find((s) => s.label === servingLabel) ?? food.defaultServing) : food.defaultServing;
  return serving.grams * Math.max(0, quantity);
}

function scaleOrNull(value: number | null, factor: number): number | null {
  return value === null ? null : Math.round(value * factor * 10) / 10;
}

export function nutritionForGrams(n100: FoodNutrition100g, grams: number): FoodNutrition100g {
  const factor = grams / 100;
  return {
    calories: Math.round(n100.calories * factor),
    proteinG: scaleOrNull(n100.proteinG, factor) ?? 0,
    carbsG: scaleOrNull(n100.carbsG, factor) ?? 0,
    fatG: scaleOrNull(n100.fatG, factor) ?? 0,
    fiberG: scaleOrNull(n100.fiberG, factor),
    sugarG: scaleOrNull(n100.sugarG, factor),
    sodiumMg: n100.sodiumMg === null ? null : Math.round(n100.sodiumMg * factor),
    saturatedFatG: scaleOrNull(n100.saturatedFatG, factor),
  };
}

// ── Search + barcode ─────────────────────────────────────────────────────

export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: ["food-search", query],
    queryFn: () => apiFetch<{ success: true; data: FoodSearchGroups }>(`/api/mobile/nutrition/food/search?q=${encodeURIComponent(query)}`).then((r) => r.data),
    // Always enabled (even for an empty query) so opening search shows a
    // "browsing" result — recent history + first-page common/branded — per
    // the search endpoint's own behavior, rather than a blank screen.
  });
}

export type BarcodeLookupResult =
  | { found: true; food: FoodRecord }
  | { found: false; action: "open_label_scan" };

export async function lookupBarcode(code: string): Promise<BarcodeLookupResult> {
  const res = await apiFetch<{ success: true; data: BarcodeLookupResult }>(`/api/mobile/nutrition/food/barcode?code=${encodeURIComponent(code)}`);
  return res.data;
}

// ── Custom foods ─────────────────────────────────────────────────────────

export function useMyCustomFoods() {
  return useQuery({
    queryKey: ["my-custom-foods"],
    queryFn: () => apiFetch<{ success: true; data: FoodRecord[] }>("/api/mobile/nutrition/food/custom").then((r) => r.data),
  });
}

export interface CustomFoodInput {
  name: string;
  brandName?: string;
  barcode?: string;
  nutrition100g: FoodNutrition100g;
  servings: FoodServing[];
}

export function useCreateCustomFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomFoodInput) =>
      apiFetch<{ success: true; data: FoodRecord }>("/api/mobile/nutrition/food/custom/create", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-custom-foods"] }),
  });
}

export function useUpdateCustomFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomFoodInput & { id: string; archived?: boolean }) =>
      apiFetch<{ success: true; data: FoodRecord }>("/api/mobile/nutrition/food/custom/update", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-custom-foods"] }),
  });
}

export function useDeleteCustomFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: true }>("/api/mobile/nutrition/food/custom/delete", { method: "POST", body: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-custom-foods"] }),
  });
}

// ── Label scan (OCR contract) ────────────────────────────────────────────

export interface OcrExtractedNutritionFields {
  name: string | null;
  brandName: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  saturatedFatG: number | null;
  servingLabel: string | null;
  servingGrams: number | null;
}

export function useLabelScan() {
  return useMutation({
    mutationFn: (imageBase64: string) =>
      apiFetch<{ success: true; data: { fields: OcrExtractedNutritionFields; rawText: string } }>("/api/mobile/nutrition/food/label-scan", {
        method: "POST",
        body: { imageBase64 },
      }),
  });
}

// ── Moderation + Open Food Facts submission ─────────────────────────────

export function useReportMissingFood() {
  return useMutation({
    mutationFn: (input: { barcode?: string; queryText?: string; note?: string }) =>
      apiFetch<{ success: true; message: string }>("/api/mobile/nutrition/food/report-missing", { method: "POST", body: input }),
  });
}

export function useRequestOffSubmission() {
  return useMutation({
    mutationFn: (customFoodId: string) =>
      apiFetch<{ success: true; data: { id: string } }>("/api/mobile/nutrition/food/off-submission/request", {
        method: "POST",
        body: { customFoodId },
      }),
  });
}

export function useConsentOffSubmission() {
  return useMutation({
    mutationFn: (submissionId: string) =>
      apiFetch<{ success: true; message: string }>("/api/mobile/nutrition/food/off-submission/consent", {
        method: "POST",
        body: { submissionId },
      }),
  });
}
