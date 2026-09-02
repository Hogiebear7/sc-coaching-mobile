import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors SessionTier/LoadBand in the main repo's lib/workout-helper.ts.
export type SessionTier = "full" | "standard" | "reduced";
export type LoadBand = "none" | "light" | "moderate" | "high";

export interface WorkoutHelperTier {
  tier: SessionTier;
  tierLabel: string;
  /** Why the app landed on this tier — readiness, 7-day load, and/or a
      heavy session already booked/planned for today. Always safe to show
      as-is. */
  rationale: string;
  loadBand: LoadBand;
  loadBandLabel: string;
  readinessScore: number | null;
}

// Today's session tier from the same deterministic Workout Helper logic the
// web dashboard uses (lib/workout-helper.ts's decideTier in the main repo) —
// lets the mobile Workout Generator scale what it builds instead of always
// generating a flat prescription regardless of readiness, training load, or
// what's already on the calendar today.
export function useWorkoutHelperTier() {
  return useQuery({
    queryKey: ["workout-helper-tier"],
    queryFn: () =>
      apiFetch<{ success: true; data: WorkoutHelperTier }>("/api/mobile/workout-helper/tier").then((r) => r.data),
  });
}
