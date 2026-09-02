import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { MemberTier } from "@/lib/member-access";

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

export type DietaryPreference =
  | "standard"
  | "vegetarian"
  | "pescetarian"
  | "vegan"
  | "low_carb"
  | "keto"
  | "paleo"
  | "mediterranean"
  | "intermittent_fasting";
export type MeasurementUnits = "metric" | "imperial";

// Mirrors ProfileData in the main repo's lib/profile-data.ts.
export interface ProfileData {
  email: string;
  fullName: string;
  phone: string;
  dateOfBirth: string | null;
  gender: Gender;
  primaryGoal: PrimaryGoal;
  secondaryGoal: PrimaryGoal | null;
  sportPlayed: string | null;
  additionalInfo: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContact2Name: string | null;
  emergencyContact2Phone: string | null;
  currentWeightKg: number | null;
  heightCm: number | null;
  // ISO 3166-1 alpha-2 (e.g. "IE") — nudges food-search ranking toward
  // locally-relevant results server-side (see the main repo's
  // lib/food-catalog.ts country boost). null = no boost, not an error.
  country: string | null;
  dietaryPreference: DietaryPreference;
  allergies: string[];
  intolerancesOrMedical: string[];
  dietaryNotes: string | null;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  reminderTimingsMins: number[] | null;
  preferredUnits: MeasurementUnits;
  restTimerSeconds: number;
  avatarDataUrl: string | null;
  cycleTrackingEligible: boolean;
  allTimeStats: { classesCompleted: number; totalWeightKg: number; totalDistanceKm: number };
  memberTier: MemberTier;
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

// Reads tier off the same profile fetch every screen already makes rather
// than a dedicated round-trip. Defaults to "free" while loading/erroring —
// gated UI stays hidden rather than briefly flashing a feature that then
// gets pulled away once the real tier loads.
export function useMemberTier(): MemberTier {
  const { data } = useProfile();
  return data?.memberTier ?? "free";
}

export interface ProfileUpdateInput {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  primaryGoal: PrimaryGoal;
  secondaryGoal?: string;
  sportPlayed?: string;
  heightCm?: string;
  country?: string;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      // dateOfBirth/gender/heightCm/primaryGoal all feed the calorie/macro
      // target's TDEE and goal-bias math — see the equivalent comment in
      // weekly-training.ts.
      qc.invalidateQueries({ queryKey: ["my-nutrition-target"] });
      qc.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });
    },
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

export function useSetRestTimerSeconds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (restTimerSeconds: number) =>
      apiFetch<{ success: true }>("/api/profile/rest-timer", {
        method: "POST",
        body: { restTimerSeconds },
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

// Sends a confirmation link to newEmail — the account's email only actually
// changes once that link is opened and confirmed (see useConfirmEmailChange
// and gym-app's /api/profile/change-email/confirm).
export function useRequestEmailChange() {
  return useMutation({
    mutationFn: (newEmail: string) =>
      apiFetch<{ success: true; message: string }>("/api/profile/change-email/request", {
        method: "POST",
        body: { newEmail },
      }),
  });
}

export function useConfirmEmailChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ success: true; email: string }>("/api/profile/change-email/confirm", {
        method: "POST",
        body: { token },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
