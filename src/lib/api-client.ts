import { API_BASE_URL } from "@/constants/config";
import { clearToken, getToken } from "./token-store";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Set by AuthProvider so any 401 anywhere in the app (not just from an
// explicit auth screen) clears the stale token and drops the user back to
// login — the backend is the single source of truth on whether a token is
// still valid.
let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; skipAuth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, skipAuth = false } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!skipAuth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response — fall through to the status-based error below.
  }

  if (!res.ok) {
    if (res.status === 401 && !skipAuth) {
      await clearToken();
      onUnauthorized?.();
    }
    const message =
      json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : `Request failed (${res.status}).`;
    throw new ApiError(res.status, message);
  }

  return json as T;
}
