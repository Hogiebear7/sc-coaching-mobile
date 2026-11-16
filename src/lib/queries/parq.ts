import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// The PAR-Q health check a gym member completes before booking (gym-app's lib/parq.ts, GET/POST /api/parq). The wording comes from the server, so
// it can change without an app update. Older servers 404 this, so the hook just reports "no form".
export interface ParqForm {
  needed: boolean;
  current: boolean;
  answeredAt: string | null;
  questions: { id: string; text: string }[];
  intro: string;
  consent: string;
  declaration: string;
  footer: string;
}

export interface ParqSubmission {
  answers: Record<string, { yes: boolean; note: string }>;
  consent: boolean;
  declaration: boolean;
  guardianName?: string;
}

export function useParq(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["parq"],
    queryFn: async () => (await apiFetch<{ success: true; data: ParqForm }>("/api/parq")).data,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

export function useSubmitParq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ParqSubmission) => apiFetch<{ success: true; message: string }>("/api/parq", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parq"] }),
  });
}
