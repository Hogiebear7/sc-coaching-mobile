import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export interface AiConsentState {
  granted: boolean;
  version: number;
  grantedAt: string | null;
}

export function useAiConsent() {
  return useQuery({
    queryKey: ["ai-consent"],
    queryFn: () => apiFetch<{ success: true; data: AiConsentState }>("/api/profile/ai-consent").then((r) => r.data),
  });
}

/** Grant or withdraw. Withdrawing takes effect on the very next AI request. */
export function useSetAiConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (granted: boolean) =>
      apiFetch<{ success: true; data: AiConsentState }>("/api/profile/ai-consent", { method: "POST", body: { granted } }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["ai-consent"], data);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
