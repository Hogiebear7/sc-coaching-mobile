import { Linking } from "react-native";

import { API_BASE_URL } from "@/constants/config";
import { apiFetch } from "@/lib/api-client";

// The website's membership page, opened already signed in through the web
// hand-over. source=app makes the page show in-person memberships, class
// packs and passes only: store rules allow paying on the web for in-person
// gym services, never for the app's own digital subscription.
export const MEMBERSHIP_WEB_PATH = "/dashboard/membership?source=app";

export async function openMembershipOnWeb(): Promise<void> {
  try {
    const res = await apiFetch<{ success: true; data: { token: string } }>("/api/mobile/auth/web-handoff", {
      method: "POST",
    });
    const params = new URLSearchParams({ token: res.data.token, next: MEMBERSHIP_WEB_PATH });
    await Linking.openURL(`${API_BASE_URL}/api/auth/web-handoff?${params.toString()}`);
  } catch {
    await Linking.openURL(`${API_BASE_URL}${MEMBERSHIP_WEB_PATH}`);
  }
}
