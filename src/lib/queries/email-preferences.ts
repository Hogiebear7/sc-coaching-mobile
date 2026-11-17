import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// The member's optional-email choices (server: /api/profile/email-preferences). Booking, billing and security emails are separate and never affected.
export interface EmailPrefs {
  tips: boolean;
  marketing: boolean;
}

export function useEmailPrefs() {
  return useQuery({
    queryKey: ["email-preferences"],
    queryFn: () => apiFetch<{ success: true; data: EmailPrefs }>("/api/profile/email-preferences").then((r) => r.data),
  });
}

export function useSetEmailPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<EmailPrefs>) =>
      apiFetch<{ success: true; data: EmailPrefs }>("/api/profile/email-preferences", { method: "POST", body: { ...patch, source: "app-settings" } }).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(["email-preferences"], data),
  });
}
