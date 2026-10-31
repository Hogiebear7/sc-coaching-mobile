import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { apiFetch, ApiError, registerUnauthorizedHandler } from "./api-client";
import { cancelCheckinReminder, syncCheckinReminder } from "./checkin-reminder";
import { registerForPushNotificationsAsync, unregisterPushToken } from "./push-notifications";
import { cacheUser, forgetCachedUser, readCachedUser, signInCheckFailure } from "./session-keeper";
import { clearToken, getToken, setToken as persistToken } from "./token-store";

export interface AuthUser {
  id: string;
  email: string;
  role: "member" | "coach" | "admin" | "admin_manager";
}

interface LoginResponse {
  success: true;
  token: string;
  user: AuthUser;
}

// A staff/coach account has no ProfileRecord by default (see
// provision-member-profile route) — "viewMode" lets them opt into the
// member (tabs) screens once one exists. Resets to "coach" on every fresh
// launch, so it's in-memory only, not persisted.
export type ViewMode = "coach" | "member";

interface AuthContextValue {
  status: "loading" | "signedOut" | "signedIn";
  user: AuthUser | null;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Set directly after signup, which returns the same shape as login.
  setSession: (token: string, user: AuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const START_CHECK_LIMIT_MS = 6000;

/** Checks the saved sign-in with the server, saves the renewed one it hands back, and returns the account. Throws when it can't. */
async function checkIn(): Promise<AuthUser> {
  const me = await apiFetch<{ user: AuthUser; token?: string }>("/api/mobile/auth/me");
  if (me.token) await persistToken(me.token);
  await cacheUser(me.user);
  return me.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("coach");

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      void forgetCachedUser();
      setUser(null);
      setStatus("signedOut");
    });
    return () => registerUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setStatus("signedOut");
        return;
      }
      // The splash waits on this, so a server that never answers (a weak signal, or the phone slow to give a widget-opened app its network)
      // counts as no signal after a few seconds: the member carries on as their saved account while the check finishes behind.
      const check = checkIn();
      let timedOut = false;
      try {
        const me = await Promise.race([
          check,
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              timedOut = true;
              reject(new ApiError(0, "Sign-in check timed out"));
            }, START_CHECK_LIMIT_MS)
          ),
        ]);
        setUser(me);
        setStatus("signedIn");
        void registerForPushNotificationsAsync().then(() => syncCheckinReminder());
      } catch (error) {
        // Only a rejected sign-in signs out (apiFetch has already removed the token). No signal or a server hiccup keeps the member signed in
        // as the account they last had; the next check (on returning to the app) renews it. See session-keeper.ts.
        const cached = signInCheckFailure(error) === "keep" ? await readCachedUser() : null;
        if (cached) {
          setUser(cached);
          setStatus("signedIn");
        } else {
          setStatus("signedOut");
        }
        if (timedOut) {
          // A late answer still counts (a rejected one signs out through apiFetch's 401 handler).
          check.then(
            (me) => {
              setUser(me);
              setStatus("signedIn");
            },
            () => {}
          );
        }
      }
    })();
  }, []);

  // Each return to the app renews the 7-day sign-in, so it lasts as long as the app is used. A rejected one signs out (via apiFetch's 401).
  useEffect(() => {
    if (status !== "signedIn") return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void checkIn().then(setUser, () => {});
    });
    return () => sub.remove();
  }, [status]);

  async function login(email: string, password: string) {
    const res = await apiFetch<LoginResponse>("/api/mobile/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    await persistToken(res.token);
    await cacheUser(res.user);
    setUser(res.user);
    setStatus("signedIn");
    void registerForPushNotificationsAsync().then(() => syncCheckinReminder());
  }

  async function setSession(token: string, sessionUser: AuthUser) {
    await persistToken(token);
    await cacheUser(sessionUser);
    setUser(sessionUser);
    setStatus("signedIn");
    void registerForPushNotificationsAsync().then(() => syncCheckinReminder());
  }

  async function logout() {
    await unregisterPushToken();
    await cancelCheckinReminder();
    await clearToken();
    await forgetCachedUser();
    setUser(null);
    setStatus("signedOut");
    setViewMode("coach");
  }

  return (
    <AuthContext.Provider value={{ status, user, viewMode, setViewMode, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
