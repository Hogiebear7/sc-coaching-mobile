import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { apiFetch, ApiError, registerUnauthorizedHandler } from "./api-client";
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

interface AuthContextValue {
  status: "loading" | "signedOut" | "signedIn";
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Set directly after signup, which returns the same shape as login.
  setSession: (token: string, user: AuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
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
      try {
        const me = await apiFetch<{ user: AuthUser }>("/api/mobile/auth/me");
        setUser(me.user);
        setStatus("signedIn");
      } catch {
        await clearToken();
        setStatus("signedOut");
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await apiFetch<LoginResponse>("/api/mobile/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    await persistToken(res.token);
    setUser(res.user);
    setStatus("signedIn");
  }

  async function setSession(token: string, sessionUser: AuthUser) {
    await persistToken(token);
    setUser(sessionUser);
    setStatus("signedIn");
  }

  async function logout() {
    await clearToken();
    setUser(null);
    setStatus("signedOut");
  }

  return (
    <AuthContext.Provider value={{ status, user, login, logout, setSession }}>
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
