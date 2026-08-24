import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Up to 3 exercise names the member curates for the Workouts tab's
// Progression quick-view chips (see
// app/api/profile/pinned-progression-exercises/route.ts, which
// normalizes/caps server-side regardless of what's sent here). A separate
// pin list from useUpdatePinnedExercises (Personal Bests) since the two
// cards serve different purposes.
export function useUpdatePinnedProgressionExercises() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pinnedProgressionExercises: string[]) =>
      apiFetch<{ success: true; pinnedProgressionExercises: string[] }>("/api/profile/pinned-progression-exercises", {
        method: "POST",
        body: { pinnedProgressionExercises },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
