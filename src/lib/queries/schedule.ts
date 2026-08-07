import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors ScheduleData in the main repo's lib/schedule-data.ts.
export interface ScheduleClass {
  id: string;
  title: string;
  category: string;
  date: string;
  startTime: string;
  durationMins: number;
  capacity: number;
  coachEmail: string;
  imageUrl: string | null;
  imageAlt: string | null;
  bookedCount: number;
  isBookedByMe: boolean;
  isWaitlistedByMe: boolean;
  waitlistPosition: number | null;
  waitlistOfferState: "queued" | "offered" | null;
  waitlistEntryId: string | null;
  offerExpiresAt: string | null;
  isFull: boolean;
  blockReason: string | null;
}

export interface ScheduleUpcomingBooking {
  bookingId: string;
  classId: string;
  title: string;
  category: string;
  date: string;
  startTime: string;
  durationMins: number;
}

export interface ScheduleData {
  classes: ScheduleClass[];
  categories: { id: string; label: string }[];
  deletedLabels: Record<string, string>;
  remainingSessions: number | null;
  noActiveMembership: boolean;
  upcomingBookings: ScheduleUpcomingBooking[];
  cancellationCutoffHours: number;
}

interface ScheduleResponse {
  success: true;
  data: ScheduleData;
}
interface ActionResponse {
  success: boolean;
  message: string;
}

export function useSchedule() {
  return useQuery({
    queryKey: ["schedule"],
    queryFn: () => apiFetch<ScheduleResponse>("/api/mobile/schedule").then((r) => r.data),
  });
}

export function useBookClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) =>
      apiFetch<ActionResponse>("/api/bookings/create", { method: "POST", body: { classId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch<ActionResponse>("/api/bookings/cancel", { method: "POST", body: { bookingId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useJoinWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) =>
      apiFetch<ActionResponse>("/api/bookings/waitlist/join", { method: "POST", body: { classId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
}

export function useLeaveWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) =>
      apiFetch<ActionResponse>("/api/bookings/waitlist/leave", { method: "POST", body: { classId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
}

export function useRespondToOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { entryId: string; action: "accept" | "reject" }) =>
      apiFetch<ActionResponse>("/api/bookings/waitlist/respond", { method: "POST", body: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
