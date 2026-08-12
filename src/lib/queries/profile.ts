import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export type Gender = "Male" | "Female" | "Other";
export type PrimaryGoal =
  | "Weight Loss"
  | "Build Muscle"
  | "Maintenance"
  | "Injury Recovery"
  | "Sports Performance"
  | "General Health"
  | "Improve Fitness"
  | "Improve Mobility";

export type DietaryPreference = "standard" | "vegetarian" | "pescetarian" | "vegan";
export type MeasurementUnits = "metric" | "imperial";

// Mirrors ProfileData in the main repo's lib/profile-data.ts.
export interface ProfileData {
  email: string;
  fullName: string;
  phone: string;
  dateOfBirth: string | null;
  gender: Gender;
  primaryGoal: PrimaryGoal;
  sportPlayed: string | null;
  additionalInfo: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContact2Name: string | null;
  emergencyContact2Phone: string | null;
  currentWeightKg: number | null;
  dietaryPreference: DietaryPreference;
  allergies: string[];
  intolerancesOrMedical: string[];
  dietaryNotes: string | null;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  reminderTimingsMins: number[] | null;
  preferredUnits: MeasurementUnits;
  avatarDataUrl: string | null;
  cycleTrackingEligible: boolean;
  allTimeStats: { classesCompleted: number; totalWeightKg: number; totalDistanceKm: number };
}

interface ProfileResponse {
  success: true;
  data: ProfileData;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<ProfileResponse>("/api/mobile/profile").then((r) => r.data),
  });
}

export interface ProfileUpdateInput {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  primaryGoal: PrimaryGoal;
  sportPlayed?: string;
  additionalInfo?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  dietaryPreference?: DietaryPreference;
  allergies?: string[];
  intolerancesOrMedical?: string[];
  dietaryNotes?: string;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) =>
      apiFetch<{ success: true; message: string }>("/api/profile/update", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

// Backfills a minimal member ProfileRecord for a staff/coach account —
// idempotent, safe to call every time the coach switches into member view.
export function useProvisionMemberProfile() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: true; alreadyExisted: boolean }>("/api/mobile/coach/provision-member-profile", {
        method: "POST",
      }),
  });
}

export function useSetPushNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pushNotificationsEnabled: boolean) =>
      apiFetch<{ success: true }>("/api/profile/push-notifications", {
        method: "POST",
        body: { pushNotificationsEnabled },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useSetEmailNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emailNotificationsEnabled: boolean) =>
      apiFetch<{ success: true }>("/api/profile/email-notifications", {
        method: "POST",
        body: { emailNotificationsEnabled },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useSetUnits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferredUnits: MeasurementUnits) =>
      apiFetch<{ success: true }>("/api/profile/units", {
        method: "POST",
        body: { preferredUnits },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

// null/[] resets to defaults (see app/api/profile/reminders/route.ts).
export function useSetReminderTimings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (timings: number[] | null) =>
      apiFetch<{ success: true; message: string }>("/api/profile/reminders", {
        method: "POST",
        body: { timings },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

// avatarDataUrl: null removes the photo. Only appearance-related fields this
// app sends — palette/theme are deliberately not exposed on mobile (one
// fixed navy/gold design), so those are always omitted from the body.
export function useSetAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (avatarDataUrl: string | null) =>
      apiFetch<{ success: true; message: string }>("/api/profile/appearance", {
        method: "POST",
        body: { avatarDataUrl },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

// Fires a reset-password email to the signed-in member's own address, same
// action as web Settings' "Reset password" button. Public endpoint — no
// userId needed, just the known email.
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ success: true; message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      }),
  });
}
