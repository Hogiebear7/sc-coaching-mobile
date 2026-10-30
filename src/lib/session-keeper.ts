import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiError } from "./api-client";

// Keeping the member signed in (owner decision 2026-10-30). The server's app sign-in lasts 7 days and is renewed every time the app checks
// in (/api/mobile/auth/me returns a fresh token), so it runs out only after 7 days of not using the app. The app signs out only when the
// server says the sign-in is no longer valid (401). No signal, a timeout or the server restarting during a deploy keeps the member signed in
// with the account they last had, and the check is simply tried again later.

export interface CachedUser {
  id: string;
  email: string;
  role: "member" | "coach" | "admin" | "admin_manager";
}

const USER_KEY = "sc.authUser";

/** What a failed sign-in check means: only a rejected sign-in signs the member out. */
export function signInCheckFailure(error: unknown): "signOut" | "keep" {
  return error instanceof ApiError && error.status === 401 ? "signOut" : "keep";
}

export async function cacheUser(user: CachedUser): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, email: user.email, role: user.role }));
  } catch {
    // Best-effort: without it, a start-up with no signal shows the login screen instead.
  }
}

export async function readCachedUser(): Promise<CachedUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    const u = raw ? (JSON.parse(raw) as Partial<CachedUser>) : null;
    return u && typeof u.id === "string" && typeof u.email === "string" && typeof u.role === "string" ? (u as CachedUser) : null;
  } catch {
    return null;
  }
}

export async function forgetCachedUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch {
    // Best-effort.
  }
}
