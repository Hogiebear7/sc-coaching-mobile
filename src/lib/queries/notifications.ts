import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors NotificationType/NotificationRecord in the main repo's lib/db.ts.
export type NotificationType =
  | "message"
  | "membership"
  | "class_reminder"
  | "booking_confirmed"
  | "booking_cancelled"
  | "cancellation"
  | "waitlist_offer"
  | "waitlist_timeout"
  | "readiness_alert"
  | "cancellation_credit_restored"
  | "no_show";

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  linkHref: string | null;
  dedupeKey: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  success: true;
  notifications: NotificationRecord[];
}

// Polled rather than push-only so the bell badge stays right even when a
// reminder arrives while the app is backgrounded and push delivery is
// unreliable (simulator, notifications permission denied, etc).
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationsResponse>("/api/mobile/notifications").then((r) => r.notifications),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/mobile/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/mobile/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
