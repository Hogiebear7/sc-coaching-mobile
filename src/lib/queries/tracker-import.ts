import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors TrackerStatsExtraction in the main repo's lib/ai.ts. Every field
// is whatever could actually be read off a fitness tracker/wearable app
// screenshot — null means it wasn't visible, not zero.
export interface TrackerStatsExtraction {
  activityTitle: string | null;
  durationMins: number | null;
  distanceKm: number | null;
  calories: number | null;
  avgHeartRate: number | null;
  sleepHours: number | null;
  otherReadings: string | null;
}

export function useTrackerImportScan() {
  return useMutation({
    mutationFn: (imageBase64: string) =>
      apiFetch<{ success: true; configured: true; stats: TrackerStatsExtraction }>("/api/mobile/tracker-import/scan", {
        method: "POST",
        body: { imageBase64 },
      }),
  });
}
