import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { noteCheckinSaved } from "@/lib/checkin-reminder";

// Mirrors RecoveryData in the main repo's lib/recovery-data.ts.
export interface RecoveryLogSummary {
  id: string;
  date: string;
  sleepHours: number | null;
  sleepQuality: number | null;
  soreness: number | null;
  fatigue: number | null;
  trainingDurationMins: number | null;
  rpe: number | null;
  goal: string | null;
  notes: string | null;
  /** The optional "injured or sick?" note (App tier or gym Membership). Absent from an older server. */
  healthNote?: string | null;
  readinessScore: number | null;
}

export interface RecoveryData {
  /** True when this member can write the "injured or sick?" note; the check-in shows the field only then. Absent from an older server = false. */
  healthNoteEnabled?: boolean;
  logs: RecoveryLogSummary[];
  latestReadinessScore: number | null;
  latestGuidance: string | null;
  rollingLoad: { sevenDaySum: number; sevenDayAverage: number; daysWithLoad: number };
  phaseNote: string | null;
  hasLoggedToday: boolean;
  todayISO: string;
}

interface RecoveryResponse {
  success: true;
  data: RecoveryData;
}

export function useRecovery() {
  return useQuery({
    queryKey: ["recovery"],
    queryFn: () => apiFetch<RecoveryResponse>("/api/mobile/recovery").then((r) => r.data),
  });
}

export interface CheckInInput {
  date: string;
  sleepHours: number;
  sleepQuality: number;
  soreness: number;
  fatigue: number;
  trainingDurationMins?: number;
  rpe?: number;
  /** Sent only when the member can write one (healthNoteEnabled). An empty string clears the note; leaving it out keeps what is saved. */
  healthNote?: string;
}

export function useLogRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckInInput) => {
      const body: Record<string, string> = {
        date: input.date,
        sleepHours: String(input.sleepHours),
        sleepQuality: String(input.sleepQuality),
        soreness: String(input.soreness),
        fatigue: String(input.fatigue),
      };
      if (input.trainingDurationMins !== undefined) body.trainingDurationMins = String(input.trainingDurationMins);
      if (input.rpe !== undefined) body.rpe = String(input.rpe);
      if (input.healthNote !== undefined) body.healthNote = input.healthNote;
      return apiFetch<{ success: boolean; message: string }>("/api/recovery/log", { method: "POST", body });
    },
    onSuccess: (_res, input) => {
      void noteCheckinSaved(input.date);
      qc.invalidateQueries({ queryKey: ["recovery"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // A same-date Recovery check-in overrides the weekly plan as the
      // day's exertion input to the calorie/macro target — without this,
      // logging recovery leaves the Nutrition tab showing a stale number.
      qc.invalidateQueries({ queryKey: ["my-nutrition-target"] });
      qc.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });
      // Readiness and rolling load also drive the Workout Helper's tier.
      qc.invalidateQueries({ queryKey: ["workout-helper-tier"] });
    },
  });
}
