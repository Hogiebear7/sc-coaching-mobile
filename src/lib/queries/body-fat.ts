import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors lib/queries/body-weight.ts exactly, for BodyFatLogRecord in the
// main repo's lib/db.ts. Reuses the existing web-only /api/profile/body-fat
// route — verifyRequestSession accepts a Bearer token exactly like a
// session cookie, so no mobile-namespaced duplicate route is needed.
export interface BodyFatLog {
  id: string;
  userId: string;
  date: string;
  bodyFatPct: number;
  createdAt: string;
}

export function useBodyFatLogs() {
  return useQuery({
    queryKey: ["body-fat-logs"],
    queryFn: () => apiFetch<{ success: true; data: BodyFatLog[] }>("/api/profile/body-fat").then((r) => r.data),
  });
}

export function useLogBodyFat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; bodyFatPct: number }) =>
      apiFetch<{ success: true; message: string }>("/api/profile/body-fat", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body-fat-logs"] }),
  });
}
