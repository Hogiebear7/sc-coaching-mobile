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
  currentWeightKg: number | null;
  dietaryPreference: "standard" | "vegetarian" | "pescetarian" | "vegan";
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
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
