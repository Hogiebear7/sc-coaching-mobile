import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors ShoppingListItemRecord in the main repo's lib/db.ts. displayText
// is always what's shown; normalizedName/quantity/unit are best-effort
// structure kept alongside it (never the only thing stored) so "add
// ingredients from a recipe" can merge sensibly against what's already here.
export interface ShoppingListItem {
  id: string;
  userId: string;
  displayText: string;
  normalizedName: string | null;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  sourceRecipeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListAddItem {
  displayText: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  sourceRecipeId?: string | null;
}

export function useShoppingList() {
  return useQuery({
    queryKey: ["shopping-list"],
    queryFn: () => apiFetch<{ success: true; data: ShoppingListItem[] }>("/api/mobile/nutrition/shopping-list").then((r) => r.data),
  });
}

// Batch by design — a single "+ Add item" is a one-item array, "Add
// ingredients to shopping list" from a saved recipe is a many-item array in
// the same call. The server does the conservative name-based merge.
export function useAddShoppingListItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ShoppingListAddItem[]) =>
      apiFetch<{ success: true; data: ShoppingListItem[] }>("/api/mobile/nutrition/shopping-list/add", {
        method: "POST",
        body: { items },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
  });
}

export function useToggleShoppingListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true; data: ShoppingListItem }>("/api/mobile/nutrition/shopping-list/toggle", {
        method: "POST",
        body: { id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
  });
}

export function useDeleteShoppingListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>("/api/mobile/nutrition/shopping-list/delete", { method: "POST", body: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
  });
}
