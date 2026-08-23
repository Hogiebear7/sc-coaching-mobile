import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiFetch } from "./api-client";

// Foreground behavior: still show an alert/banner even while the app is
// open, matching how the web app's browser push behaves.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let lastRegisteredToken: string | null = null;

function getProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

// Requests permission, obtains this device's Expo push token, and registers
// it with the backend against the signed-in member. Safe to call multiple
// times (e.g. every app start) — the backend upserts by (userId, token).
//
// Silently no-ops (returns null) when push can't work in this environment:
// web (no native push), simulators (Device.isDevice is false), permission
// denied, or — until `eas init` has been run for this project — no EAS
// projectId configured yet. None of these block the rest of the app; push
// simply activates automatically once the missing piece is available.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.log("[push] no EAS projectId configured yet — skipping token registration");
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token === lastRegisteredToken) return token;

    await apiFetch("/api/mobile/push", {
      method: "POST",
      body: { token, deviceInfo: `${Device.modelName ?? Platform.OS} · ${Platform.OS} ${Platform.Version}` },
    });
    lastRegisteredToken = token;
    return token;
  } catch (err) {
    console.log("[push] failed to register push token", err);
    return null;
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (!lastRegisteredToken) return;
  const token = lastRegisteredToken;
  lastRegisteredToken = null;
  try {
    await apiFetch("/api/mobile/push", { method: "DELETE", body: { token } });
  } catch {
    // Best-effort — an orphaned token is harmless; the send path self-heals
    // via DeviceNotRegistered cleanup once it's no longer valid.
  }
}

// Web-app dashboard paths (see lib/push.ts payload.linkHref call sites in
// the main repo) mapped to their native-app equivalents. Unrecognized or
// not-yet-built paths fall back to Home rather than a dead route.
const LINK_HREF_ROUTES: Record<string, string> = {
  "/dashboard/schedule": "/(tabs)/schedule",
  "/dashboard/bookings": "/(tabs)/schedule",
  "/dashboard/membership": "/membership",
  "/dashboard/messages": "/messages",
  // The live-workout-in-progress notification (workout-draft.tsx) sets
  // linkHref to an already-valid native route rather than a web dashboard
  // path — passed through as-is instead of falling back to Home.
  "/log-workout": "/log-workout",
};

export function mapLinkHrefToRoute(linkHref: string): string {
  return LINK_HREF_ROUTES[linkHref] ?? "/(tabs)";
}

// Wires a tap on a delivered notification to in-app navigation, using the
// same linkHref convention the web app's push notifications already use.
export function addNotificationTapListener(onLinkHref: (linkHref: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const linkHref = response.notification.request.content.data?.linkHref;
    if (typeof linkHref === "string" && linkHref) onLinkHref(linkHref);
  });
  return () => sub.remove();
}
