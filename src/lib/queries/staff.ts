import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors StaffClassSummary in the main repo's lib/staff-classes-data.ts.
export interface StaffClassRosterEntry {
  bookingId: string;
  userId: string;
  email: string;
  fullName: string | null;
  attendedAt: string | null;
}

export interface StaffClassSummary {
  id: string;
  title: string;
  category: string;
  coachUserId: string;
  coachEmail: string;
  date: string;
  startTime: string;
  durationMins: number;
  capacity: number;
  bookedCount: number;
  roster: StaffClassRosterEntry[];
}

interface StaffClassesResponse {
  success: true;
  data: StaffClassSummary[];
}

export function useStaffClasses() {
  return useQuery({
    queryKey: ["staff-classes"],
    queryFn: () => apiFetch<StaffClassesResponse>("/api/mobile/staff/classes").then((r) => r.data),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, attended }: { bookingId: string; attended: boolean }) =>
      apiFetch<{ success: true }>("/api/staff/bookings/attendance", {
        method: "POST",
        body: { bookingId, attended },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-classes"] }),
  });
}

// Mirrors StaffMemberSummary / StaffMemberDetail in
// lib/staff-members-data.ts.
export interface StaffMemberSummary {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  joinedAt: string;
  archivedAt: string | null;
  currentPlanName: string | null;
  currentStatus: string | null;
}

export interface StaffMemberDetail extends StaffMemberSummary {
  dateOfBirth: string | null;
  primaryGoal: string;
  sportPlayed: string | null;
  currentPeriodEnd: string | null;
  totalSessionsLogged: number;
  totalBookings: number;
  lastSessionDate: string | null;
}

interface StaffMembersResponse {
  success: true;
  data: StaffMemberSummary[];
}

interface StaffMemberDetailResponse {
  success: true;
  data: StaffMemberDetail;
}

export function useStaffMembers() {
  return useQuery({
    queryKey: ["staff-members"],
    queryFn: () => apiFetch<StaffMembersResponse>("/api/mobile/staff/members").then((r) => r.data),
  });
}

export function useStaffMemberDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["staff-member", userId],
    queryFn: () => apiFetch<StaffMemberDetailResponse>(`/api/mobile/staff/members/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });
}

// Mirrors StaffBusinessData in the main repo's lib/staff-business-data.ts.
export interface StaffBusinessData {
  revenue: {
    thisMonthCents: number;
    lastMonthCents: number;
    currency: string;
    taxRatePercent: number | null;
  } | null;
  membership: {
    activeMembers: number;
    newSignupsThisMonth: number;
  } | null;
  classes: {
    classesThisMonth: number;
    bookingsThisMonth: number;
    attendedThisMonth: number;
  } | null;
}

interface StaffBusinessResponse {
  success: true;
  data: StaffBusinessData;
}

export function useStaffBusiness() {
  return useQuery({
    queryKey: ["staff-business"],
    queryFn: () => apiFetch<StaffBusinessResponse>("/api/mobile/staff/business").then((r) => r.data),
  });
}
