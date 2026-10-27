import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { hasAccess, NO_ACCESS, type MemberAccess, type MemberFeature, tierFromAccess, type MemberTier } from "@/lib/member-access";
import { readProfileAccess } from "@/lib/profile-access";

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
  /** Two independent flags: a gym Membership does not include the digital features (see src/lib/member-access.ts). The SERVER decides access on every request; this only drives what the app draws. */
  memberAccess: MemberAccess;
  /** The member's live digital plan, for display (which store manages it, when it ends or renews), or null. */
  digitalPlan: DigitalPlanSummary | null;
  /** False when the server did not send valid access fields (an older server): access is then NONE and billing is unsupported. Set by the app, never by the server. */
  accessSupported: boolean;
}

export interface DigitalPlanSummary {
  source: "google_play" | "app_store" | "staff_grant";
  status: "active" | "canceled" | "in_grace_period" | "on_hold" | "paused" | "expired" | "revoked";
  currentPeriodEnd: string | null;
  autoRenewing: boolean;
  /** The current period is a free trial. */
  trial?: boolean;
  environment: "production" | "sandbox" | null;
}

interface ProfileResponse {
  success: true;
  data: ProfileData;
}

export function useProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () =>
      apiFetch<ProfileResponse>("/api/mobile/profile").then((r) => {
        const access = readProfileAccess(r.data);
        return { ...r.data, memberAccess: access.memberAccess, digitalPlan: access.digitalPlan as DigitalPlanSummary | null, accessSupported: access.accessSupported };
      }),
    enabled: options?.enabled ?? true,
  });
}

// Reads access off the same profile fetch every screen already makes rather than a dedicated round-trip. Defaults to NO access while
// loading/erroring: gated UI stays hidden rather than briefly flashing a feature that then gets pulled away once the real answer loads.
/** The access flags as the tab bar's single tier (see tierFromAccess). */
export function useMemberTier(): MemberTier {
  return tierFromAccess(useMemberAccess());
}

/** Whether this member has a feature now (src/lib/member-access.ts). False until the profile has loaded, so nothing locked is requested early. */
export function useHasFeature(feature: MemberFeature): boolean {
  return hasAccess(useMemberAccess(), feature);
}

export function useMemberAccess(): MemberAccess {
  const { data } = useProfile();
  return data?.memberAccess ?? NO_ACCESS;
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

// Permanently deletes the signed-in member's own account (POST /api/account/delete). Re-authenticates with the current password and the typed
// confirmation word. A wrong password comes back as 403, never 401, so apiFetch does not treat it as an expired session. No cache invalidation:
// the caller signs the member out on success, which is the only navigation that follows.
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (input: { password: string; confirm: string }) =>
      apiFetch<{ success: true; message: string }>("/api/account/delete", {
        method: "POST",
        body: input,
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
