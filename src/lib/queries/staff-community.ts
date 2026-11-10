import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Staff-side data for the gym community, member summaries and booking a member into a class. Mirrors gym-app's
//   /api/staff/members/[userId]/summary and /brief (lib/member-summary.ts),
//   /api/staff/bookings/create, and
//   /api/staff/community/gym-reports (+ /[id]/resolve).
// The server decides who may do what (capabilities, own gym only, the gym-Membership data wall); these hooks only carry the answer.

// ── Member summary and class brief ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type MemberState = "good" | "take_care" | "caution" | "no_recent_data";
export type FlagSeverity = "caution" | "note";

export interface SummaryFlag {
  code: string;
  severity: FlagSeverity;
  text: string;
}

export interface HealthNote {
  note: string;
  date: string;
  ageDays: number;
  mentionsIllnessOrInjury: boolean;
}

export interface MemberSummary {
  walled: false;
  asOf: string;
  name: string | null;
  goal: string | null;
  state: MemberState;
  flags: SummaryFlag[];
  training: {
    daysTrainedLast7: number;
    daysTrainedLast30: number;
    targetDaysPerWeek: number | null;
    lastSessionDate: string | null;
    daysSinceLastSession: number | null;
    effortLast3Days: "none" | "easy" | "moderate" | "hard";
    averageSessionRpeLast7: number | null;
    volumeLast7Kg: number;
    averageWeeklyVolumePrev4WeeksKg: number;
    totalLogged: number;
    recent: { date: string; title: string; rpe: number | null; durationMins: number | null }[];
  };
  checkIns: {
    checkInsLast14: number;
    latestDate: string | null;
    averageReadiness: number | null;
    readinessTrend: "improving" | "steady" | "declining" | null;
    averageSleepHours: number | null;
    averageSoreness: number | null;
    averageFatigue: number | null;
    healthNote: HealthNote | null;
  };
  nutrition: {
    daysLoggedLast3: number;
    daysLoggedLast7: number;
    averageCalories: number | null;
    caloriePercentOfTarget: number | null;
    targetCalories: number | null;
    averageProteinG: number | null;
    proteinPercentOfTarget: number | null;
    averageWaterMl: number | null;
  };
  weight: {
    latestKg: number | null;
    latestDate: string | null;
    changeLast30DaysKg: number | null;
    changeLast90DaysKg: number | null;
    weighInsLast90: number;
    goalWeightKg: number | null;
    kgToGoal: number | null;
    goalTargetDate: string | null;
  };
  classes: {
    bookedLast30: number;
    attendedLast30: number;
    missedLast30: number;
    lastAttendedDate: string | null;
    upcoming: { title: string; date: string; startTime: string }[];
  };
}

export interface MemberBrief {
  walled: false;
  asOf: string;
  name: string | null;
  state: MemberState;
  flags: SummaryFlag[];
  lines: string[];
  healthNote: HealthNote | null;
}

/** For a member without a gym Membership the server answers walled: true and no data. */
export interface WalledNotice {
  walled: true;
  message: string;
}

export function useStaffMemberSummary(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["staff-member-summary", userId],
    queryFn: () =>
      apiFetch<{ success: true; data: MemberSummary | WalledNotice }>(`/api/staff/members/${userId}/summary`).then((r) => r.data),
    enabled: !!userId && enabled,
    retry: false,
  });
}

/** The compact brief for one member; only fetched once `enabled` (a coach opening it), never for the whole roster at once. */
export function useStaffMemberBrief(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["staff-member-brief", userId],
    queryFn: () => apiFetch<{ success: true; data: MemberBrief | WalledNotice }>(`/api/staff/members/${userId}/brief`).then((r) => r.data),
    enabled: !!userId && enabled,
    retry: false,
  });
}

// ── Booking a member into a class ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type BookOutcome = "booked" | "waitlisted";

export function useBookMemberIntoClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { classId: string; userId: string }) =>
      apiFetch<{ success: true; outcome: BookOutcome; message: string }>("/api/staff/bookings/create", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-classes"] });
      qc.invalidateQueries({ queryKey: ["staff-members"] });
    },
  });
}

// ── Gym community reports ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type GymReportStatus = "open" | "resolved" | "dismissed";

export interface GymReport {
  id: string;
  /** A "group" report is of a Community group's name and description; the staff action is to close the group. */
  targetType: "post" | "comment" | "group";
  targetId: string;
  reason: string;
  status: GymReportStatus;
  createdAt: string;
  /** The reported text (for a group, its name and description); null when it can no longer be found. */
  text: string | null;
  alreadyRemoved: boolean;
  author: { userId: string; displayName: string; isStaff: boolean } | null;
  reporterName: string;
}

export function useGymReports(status: GymReportStatus = "open") {
  return useQuery({
    queryKey: ["staff-gym-reports", status],
    queryFn: () => apiFetch<{ success: true; data: GymReport[] }>(`/api/staff/community/gym-reports?status=${status}`).then((r) => r.data),
  });
}

export function useResolveGymReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: "resolve" | "dismiss" }) =>
      apiFetch<{ success: true; message: string }>(`/api/staff/community/gym-reports/${input.id}/resolve`, {
        method: "POST",
        body: { action: input.action },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-gym-reports"] });
      // A removed post or comment leaves the gym feed too.
      qc.invalidateQueries({ queryKey: ["community-gym"] });
    },
  });
}
