import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors lib/equipment-catalog.ts in the main repo — served from the API
// (not duplicated here) since it's a ~120-item list with a single source
// of truth on the backend.
export interface EquipmentCategory {
  slug: string;
  label: string;
}

export interface EquipmentItem {
  slug: string;
  label: string;
  category: string;
  subcategory: string | null;
  aliases: string[];
  sortOrder: number;
}

export interface GymProfilePreset {
  slug: string;
  name: string;
  icon: string;
  equipmentSlugs: string[];
}

export interface EquipmentCatalogData {
  categories: EquipmentCategory[];
  equipment: EquipmentItem[];
  presets: GymProfilePreset[];
}

interface EquipmentCatalogResponse {
  success: true;
  data: EquipmentCatalogData;
}

// Long-lived — this only changes on a code deploy, not member action.
export function useEquipmentCatalog() {
  return useQuery({
    queryKey: ["equipment-catalog"],
    queryFn: () => apiFetch<EquipmentCatalogResponse>("/api/mobile/equipment-catalog").then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  });
}

// Mirrors GymProfileRecord in the main repo's lib/db.ts.
export interface GymProfile {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  equipmentSlugs: string[];
  presetSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GymProfilesData {
  profiles: GymProfile[];
  activeGymProfileId: string | null;
}

interface GymProfilesResponse {
  success: true;
  data: GymProfilesData;
}

export function useGymProfiles() {
  return useQuery({
    queryKey: ["gym-profiles"],
    queryFn: () => apiFetch<GymProfilesResponse>("/api/mobile/gym-profiles").then((r) => r.data),
  });
}

export interface CreateGymProfileInput {
  name: string;
  icon: string | null;
  equipmentSlugs: string[];
  presetSlug: string | null;
}

export function useCreateGymProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGymProfileInput) =>
      apiFetch<{ success: true; message: string; data: GymProfile }>("/api/mobile/gym-profiles", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gym-profiles"] }),
  });
}

export interface UpdateGymProfileInput {
  id: string;
  name?: string;
  icon?: string | null;
  equipmentSlugs?: string[];
}

export function useUpdateGymProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGymProfileInput) =>
      apiFetch<{ success: true; message: string; data: GymProfile }>("/api/mobile/gym-profiles/update", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gym-profiles"] }),
  });
}

export function useDeleteGymProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true; message: string }>("/api/mobile/gym-profiles/delete", {
        method: "POST",
        body: { id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gym-profiles"] }),
  });
}

// id: null clears the active profile (unfiltered browsing).
export function useSetActiveGymProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) =>
      apiFetch<{ success: true; message: string }>("/api/mobile/gym-profiles/set-active", {
        method: "POST",
        body: { id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gym-profiles"] }),
  });
}
