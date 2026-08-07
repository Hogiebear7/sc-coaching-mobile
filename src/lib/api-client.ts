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

// For endpoints that stream plain text (the AI coach routes) rather than
// JSON. React Native's fetch doesn't reliably support reading a streamed
// response body chunk-by-chunk across platforms (Hermes' polyfill support
// is inconsistent), so this awaits the full text — no live token-by-token
// typing effect for now, but reliable everywhere. A streaming upgrade is a
// native-polish-phase item once this is running on real devices.
export async function apiFetchText(path: string, options: { body?: unknown } = {}): Promise<string> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      await clearToken();
      onUnauthorized?.();
    }
    let message = `Request failed (${res.status}).`;
    try {
      const json = JSON.parse(text);
      if (json && typeof json.message === "string") message = json.message;
    } catch {
      // Not JSON — keep the generic message.
    }
    throw new ApiError(res.status, message);
  }

  return text;
}
