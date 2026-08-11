import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors lib/profile-schema.ts / lib/cycle-phase.ts in the main repo.
export type CycleRegularity = "Regular" | "Irregular" | "Unsure";
export type PhaseName = "Menstrual" | "Follicular" | "Ovulatory" | "Luteal" | "Unknown";

export interface CycleSettings {
  userId: string;
  lastPeriodStartDate: string | null;
  averageCycleLengthDays: number | null;
  periodLengthDays: number | null;
  regularity: CycleRegularity | null;
  privateNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CyclePrivacy {
  userId: string;
  shareCurrentPhaseWithCoach: boolean;
  shareExactDatesWithCoach: boolean;
  shareNotesWithCoach: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseEstimate {
  phase: PhaseName;
  cycleDay: number | null;
  cycleLength: number | null;
  confidence: "standard" | "low";
  phaseLabel: string;
  explanation: string;
  trainingGuidance: string;
  intensityGuidance: string;
  recoveryGuidance: string;
  readinessNote: string;
}

export interface CycleData {
  enabled: boolean;
  menopauseSupportEnabled: boolean;
  settings: CycleSettings | null;
  privacy: CyclePrivacy | null;
  phaseEstimate: PhaseEstimate;
}

interface CycleResponse {
  success: true;
  data: CycleData;
}

export function useCycleData(enabled: boolean) {
  return useQuery({
    queryKey: ["cycle"],
    queryFn: () => apiFetch<CycleResponse>("/api/mobile/cycle").then((r) => r.data),
    enabled,
  });
}

export interface CycleSettingsInput {
  lastPeriodStartDate: string;
  averageCycleLengthDays: string;
  periodLengthDays: string;
  regularity: CycleRegularity | "";
  privateNotes: string;
}

export function useSaveCycleSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CycleSettingsInput) =>
      apiFetch<{ success: true; message: string }>("/api/cycle/settings", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export interface CyclePrivacyInput {
  shareCurrentPhaseWithCoach: boolean;
  shareExactDatesWithCoach: boolean;
  shareNotesWithCoach: boolean;
}

export function useSaveCyclePrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CyclePrivacyInput) =>
      apiFetch<{ success: true; message: string }>("/api/cycle/privacy", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cycle"] }),
  });
}

export function useSetMenopauseSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (menopauseSupportEnabled: boolean) =>
      apiFetch<{ success: true; message: string }>("/api/cycle/preferences", {
        method: "POST",
        body: { menopauseSupportEnabled },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cycle"] }),
  });
}
