import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Staff controls for one member's App Subscription and AI (gym-app: /api/staff/members/[userId]/ai-usage, /tier and /ai-pause). Viewing needs
// members.view; changing needs members.grantTier (admins). Amounts are in euros, as the owner sets them.

export interface StaffMemberAiStatus {
  totalCalls: number;
  totalCostEur: number;
  allowance: {
    kind: "free" | "trial" | "paid" | "complimentary";
    plan: { source: "google_play" | "app_store" | "staff_grant"; status: string; currentPeriodEnd: string | null; autoRenewing: boolean; trial: boolean } | null;
    paused: boolean;
    budgetEur: number | null;
    spentEur: number;
    dailyCapEur: number | null;
    spentTodayEur: number;
  };
}

const key = (userId: string) => ["staff-member-ai", userId] as const;

export function useStaffMemberAiStatus(userId: string | undefined) {
  return useQuery({
    queryKey: key(userId ?? ""),
    queryFn: () => apiFetch<{ success: true; data: StaffMemberAiStatus }>(`/api/staff/members/${userId}/ai-usage?range=month`).then((r) => r.data),
    enabled: !!userId,
    retry: false,
  });
}

export function useGrantAppAccess(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { endsOn: string | null; note: string | null }) =>
      apiFetch<{ success: true; message: string }>(`/api/staff/members/${userId}/tier`, {
        method: "POST",
        body: { tier: "app_subscription", endsOn: input.endsOn, note: input.note },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(userId) }),
  });
}

export function useRevokeAppAccess(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ success: true; message: string }>(`/api/staff/members/${userId}/tier`, { method: "POST", body: { tier: "digital_revoke" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(userId) }),
  });
}

export function useSetMemberAiPaused(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paused: boolean) => apiFetch<{ success: true; message: string }>(`/api/staff/members/${userId}/ai-pause`, { method: "POST", body: { paused } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(userId) }),
  });
}
