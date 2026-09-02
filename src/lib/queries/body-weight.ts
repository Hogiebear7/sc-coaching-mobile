import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors BodyWeightLogRecord in the main repo's lib/db.ts. Reuses the
// existing web-only /api/profile/body-weight route — verifyRequestSession
// accepts a Bearer token exactly like a session cookie, so no mobile-
// namespaced duplicate route is needed.
export interface BodyWeightLog {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  createdAt: string;
}

export function useBodyWeightLogs() {
  return useQuery({
    queryKey: ["body-weight-logs"],
    queryFn: () => apiFetch<{ success: true; data: BodyWeightLog[] }>("/api/profile/body-weight").then((r) => r.data),
  });
}

export function useLogBodyWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; weightKg: number }) =>
      apiFetch<{ success: true; message: string }>("/api/profile/body-weight", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body-weight-logs"] });
      // Current bodyweight drives the calorie/macro target's TDEE estimate
      // directly — without this, logging a new weight leaves the Nutrition
      // tab showing a stale number.
      qc.invalidateQueries({ queryKey: ["my-nutrition-target"] });
      qc.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });
    },
  });
}
