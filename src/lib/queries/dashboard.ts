import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors DashboardData in the main repo's lib/dashboard-data.ts — keep in
// sync manually since these are two separate repos with no shared package.
export interface DashboardData {
  firstName: string;
  todayISO: string;
  nextSession: {
    classId: string;
    title: string;
    date: string;
    startTime: string;
    durationMins: number;
    category: string;
    imageUrl: string | null;
    imageAlt: string | null;
  } | null;
  monthPassesRemaining: number | null;
  hasMonthPasses: boolean;
  readiness: {
    today: number | null;
    status: string | null;
    guidance: string | null;
    trend: (number | null)[];
    hasTrend: boolean;
    delta: number | null;
    phaseNote: string | null;
    pregnancyNote: string | null;
  };
  kpis: {
    sevenDaySum: number;
    daysWithLoad: number;
    loadBandLabel: string;
    weekChangePct: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    sessionsLast7: number;
  };
  nutrition: { dietaryPreference: string | null };
  club: {
    hasSubscription: boolean;
    planName: string | null;
    statusLabel: string | null;
    isActive: boolean;
    needsAttention: boolean;
    remainingSessionsLabel: string | null;
  };
  quickActions: {
    programmeEnabled: boolean;
    programmeTitle: string | null;
    primaryGoal: string | null;
  };
}

interface DashboardResponse {
  success: true;
  data: DashboardData;
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/api/mobile/dashboard").then((r) => r.data),
  });
}
