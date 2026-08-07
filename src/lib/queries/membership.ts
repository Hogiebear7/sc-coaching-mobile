import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors MembershipData in the main repo's lib/membership-data.ts.
export interface MembershipData {
  currentPlanName: string | null;
  subscriptionStatus: string | null;
  isPeriodLapsed: boolean;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionPausedUntil: string | null;
  hasActivePassAllowance: boolean;
  passBalanceRemaining: number | null;
  purchasedPasses: number;
  expiringPassesCount: number;
  expiringPassesSoonestAt: string | null;
  billingConfigured: boolean;
}

interface MembershipResponse {
  success: true;
  data: MembershipData;
}

export function useMembership() {
  return useQuery({
    queryKey: ["membership"],
    queryFn: () => apiFetch<MembershipResponse>("/api/mobile/membership").then((r) => r.data),
  });
}
