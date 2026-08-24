import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { ExerciseSection } from "@/lib/queries/workouts";
import type { WeeklyTrainingSession } from "@/lib/queries/weekly-training";

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

// Mirrors WorkoutExerciseEntry in the main repo's lib/db.ts (subset of
// fields relevant to class-workout recording).
export interface ClassWorkoutExerciseEntry {
  exerciseId: string | null;
  name: string;
  weight: string | null;
  reps: number | null;
  sets: number | null;
  rpe?: number | null;
  notes: string | null;
}

export interface ClassWorkoutRecord {
  classId: string;
  notes: string | null;
  exercises: ClassWorkoutExerciseEntry[];
  updatedByStaffId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassWorkoutCheckedInMember {
  userId: string;
  name: string;
  existingExercises: ClassWorkoutExerciseEntry[] | null;
  existingNotes: string | null;
}

export interface ClassWorkoutLibraryExercise {
  id: string;
  name: string;
  section: ExerciseSection;
}

export interface ClassWorkoutData {
  classId: string;
  classTitle: string;
  classDate: string;
  startTime: string;
  existingWorkout: ClassWorkoutRecord | null;
  checkedIn: ClassWorkoutCheckedInMember[];
  libraryExercises: ClassWorkoutLibraryExercise[];
}

interface ClassWorkoutResponse {
  success: true;
  data: ClassWorkoutData;
}

export function useClassWorkout(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-workout", classId],
    queryFn: () =>
      apiFetch<ClassWorkoutResponse>(`/api/mobile/staff/classes/${classId}/workout`).then((r) => r.data),
    enabled: !!classId,
  });
}

export interface SaveClassWorkoutResult {
  userId: string;
  notes: string;
  exercises: { name: string; weight: string; reps: number | null; sets: number | null; rpe: number | null }[];
}

export interface SaveClassWorkoutInput {
  classId: string;
  notes: string;
  exercises: { exerciseId: string | null; name: string; weight: string; reps: number | null; sets: number | null }[];
  results: SaveClassWorkoutResult[];
}

// Reuses the existing web save route (classes.manage, already Bearer-compatible).
export function useSaveClassWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, ...body }: SaveClassWorkoutInput) =>
      apiFetch<{ success: true; message: string }>(`/api/staff/classes/${classId}/workout`, {
        method: "POST",
        body,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["class-workout", variables.classId] });
      qc.invalidateQueries({ queryKey: ["staff-classes"] });
    },
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

// Reuses the existing web removal route (classes.manage) — always fully
// restores the member's credit, since this is a staff decision, not the
// member's own late cancellation.
export function useRemoveBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch<{ success: true; message: string }>("/api/staff/bookings/remove", {
        method: "POST",
        body: { bookingId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-classes"] }),
  });
}

// Mirrors ClassWorkoutTemplateRecord / ClassWorkoutTemplateExercise in the
// main repo's lib/db.ts.
export interface StaffTemplateExercise {
  exerciseId: string | null;
  name: string;
  weight: string;
  reps: number | null;
  sets: number | null;
  // "ST1", "ST2", etc — exercises sharing a label render as one station.
  supersetGroup: string | null;
  // True when reps differ per side (unilateral) — repsRight/repsLeft hold
  // the split target and reps is null.
  perSide: boolean;
  repsRight: number | null;
  repsLeft: number | null;
}

export interface StaffWorkoutTemplate {
  id: string;
  name: string;
  categories: string[];
  exercises: StaffTemplateExercise[];
  notes: string | null;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffWorkoutTemplatesData {
  templates: StaffWorkoutTemplate[];
  libraryExercises: ClassWorkoutLibraryExercise[];
}

interface StaffWorkoutTemplatesResponse {
  success: true;
  data: StaffWorkoutTemplatesData;
}

export function useStaffWorkoutTemplates() {
  return useQuery({
    queryKey: ["staff-workout-templates"],
    queryFn: () =>
      apiFetch<StaffWorkoutTemplatesResponse>("/api/mobile/staff/workout-templates").then((r) => r.data),
  });
}

export interface SaveStaffWorkoutTemplateInput {
  id?: string;
  name: string;
  categories: string[];
  notes: string;
  exercises: StaffTemplateExercise[];
}

// Reuses the existing web create/update route (classes.manage, already
// Bearer-compatible) — id present = update, absent = create.
export function useSaveStaffWorkoutTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveStaffWorkoutTemplateInput) =>
      apiFetch<{ success: true; message: string; data: StaffWorkoutTemplate }>(
        "/api/staff/workout-templates",
        { method: "POST", body: input }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-workout-templates"] }),
  });
}

export function useDeleteStaffWorkoutTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true; message: string }>("/api/staff/workout-templates/delete", {
        method: "POST",
        body: { id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-workout-templates"] }),
  });
}

export interface StaffClassCategoryOption {
  slug: string;
  name: string;
}

interface StaffClassCategoriesResponse {
  success: true;
  data: StaffClassCategoryOption[];
}

export function useStaffClassCategories() {
  return useQuery({
    queryKey: ["staff-class-categories"],
    queryFn: () =>
      apiFetch<StaffClassCategoriesResponse>("/api/mobile/staff/class-categories").then((r) => r.data),
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

export interface StaffMemberBookingSummary {
  bookingId: string;
  title: string;
  date: string;
  startTime: string;
  durationMins: number;
}

export interface StaffMemberPersonalBest {
  label: string;
  heaviestWeight: { weightStr: string; reps: number | null; date: string } | null;
  highestReps: { reps: number; date: string } | null;
}

export interface StaffMemberDetail extends StaffMemberSummary {
  dateOfBirth: string | null;
  primaryGoal: string;
  sportPlayed: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContact2Name: string | null;
  emergencyContact2Phone: string | null;
  currentPeriodEnd: string | null;
  totalSessionsLogged: number;
  totalBookings: number;
  lastSessionDate: string | null;
  coachNotes: string | null;
  latestReadinessScore: number | null;
  personalBests: StaffMemberPersonalBest[];
  upcomingBookings: StaffMemberBookingSummary[];
  pastBookings: StaffMemberBookingSummary[];
  weeklyTrainingSchedule: { sessions: WeeklyTrainingSession[]; updatedAt: string } | null;
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

// Uses the existing /api/staff/members/notes route (members.edit, coach-tier).
export function useSaveCoachNotes(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) =>
      apiFetch<{ success: true }>("/api/staff/members/notes", {
        method: "POST",
        body: { userId, notes },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-member", userId] }),
  });
}

// Mirrors MessageRecord / MessageThreadSummary in the main repo's lib/db.ts.
export interface MessageRecord {
  id: string;
  memberId: string;
  senderId: string;
  senderRole: "member" | "staff";
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface StaffMessageThreadSummary {
  memberId: string;
  memberEmail: string;
  memberName: string | null;
  memberArchived: boolean;
  lastMessageBody: string;
  lastMessageFromStaff: boolean;
  lastMessageAt: string;
  unreadFromMemberCount: number;
}

interface StaffMessageThreadsResponse {
  success: true;
  data: StaffMessageThreadSummary[];
}

export function useStaffMessageThreads() {
  return useQuery({
    queryKey: ["staff-message-threads"],
    queryFn: () => apiFetch<StaffMessageThreadsResponse>("/api/mobile/staff/messages").then((r) => r.data),
  });
}

export interface StaffMessageThread {
  memberId: string;
  memberEmail: string;
  memberName: string | null;
  messages: MessageRecord[];
}

interface StaffMessageThreadResponse {
  success: true;
  data: StaffMessageThread;
}

export function useStaffMessageThread(memberId: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["staff-message-thread", memberId],
    queryFn: async () => {
      const res = await apiFetch<StaffMessageThreadResponse>(`/api/mobile/staff/messages/${memberId}`);
      // Reading a thread marks it read server-side, so refresh the inbox's unread badges.
      qc.invalidateQueries({ queryKey: ["staff-message-threads"] });
      return res.data;
    },
    enabled: !!memberId,
  });
}

export function useSendStaffMessage(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ success: true }>("/api/messages/send", {
        method: "POST",
        body: { memberId, body },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-message-thread", memberId] });
      qc.invalidateQueries({ queryKey: ["staff-message-threads"] });
    },
  });
}

export function useDraftAiReply() {
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<{ success: true; configured: boolean; draft: string | null }>("/api/ai/draft-reply", {
        method: "POST",
        body: { memberId },
      }),
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
