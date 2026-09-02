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

// Mirrors lib/cycle-phase.ts's phaseSegments() — same day-range boundaries
// estimatePhase() uses server-side, kept here so the chart can never drift
// from the phase label/guidance the API already returned. A phase is
// omitted if the cycle is short enough to leave it no days.
export interface PhaseSegment {
  phase: Exclude<PhaseName, "Unknown">;
  label: string;
  startDay: number;
  endDay: number;
  dayCount: number;
}

export function phaseSegments(cycleLength: number, periodLengthDays: number | null): PhaseSegment[] {
  const periodLength = periodLengthDays ?? 5;
  const midCycle = Math.round(cycleLength / 2);

  const raw: { phase: Exclude<PhaseName, "Unknown">; start: number; end: number }[] = [
    { phase: "Menstrual", start: 1, end: periodLength },
    { phase: "Follicular", start: periodLength + 1, end: midCycle - 2 },
    { phase: "Ovulatory", start: midCycle - 1, end: midCycle + 1 },
    { phase: "Luteal", start: midCycle + 2, end: cycleLength },
  ];

  return raw
    .map(({ phase, start, end }) => ({
      phase,
      label: phase as string,
      startDay: Math.max(1, start),
      endDay: Math.min(cycleLength, end),
    }))
    .filter((seg) => seg.endDay >= seg.startDay)
    .map((seg) => ({ ...seg, dayCount: seg.endDay - seg.startDay + 1 }));
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
      // Cycle dates/regularity feed the calorie/macro target's cycle-phase
      // adjustment when cycle tracking is enabled — see the equivalent
      // comment in weekly-training.ts.
      qc.invalidateQueries({ queryKey: ["my-nutrition-target"] });
      qc.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });
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
