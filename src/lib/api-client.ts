import { API_BASE_URL } from "@/constants/config";
import { clearToken, getToken } from "./token-store";

export class ApiError extends Error {
  status: number;
  /** The server's stable machine-readable code, when it sent one (the billing routes always do). */
  code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
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

// AI features need the member's explicit consent to send their data to the AI provider (gym-app lib/ai-consent.ts). The server refuses such a request with
// 403 + code "ai_consent_required" BEFORE anything reaches the provider. The root AiConsentHost registers a handler that asks the member; if they allow it the
// original request is sent again once, if they decline it fails with a plain message and nothing else in the app is affected.
export const AI_CONSENT_REQUIRED_CODE = "ai_consent_required";
export const AI_DECLINED_MESSAGE = "AI features are off. You can turn them on in Settings.";
let askAiConsent: (() => Promise<boolean>) | null = null;
export function registerAiConsentHandler(handler: (() => Promise<boolean>) | null) {
  askAiConsent = handler;
}

function isConsentRefusal(status: number, json: unknown): boolean {
  return status === 403 && !!json && typeof json === "object" && "code" in json && json.code === AI_CONSENT_REQUIRED_CODE;
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; skipAuth?: boolean } = {},
  retriedAfterConsent = false
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
    if (isConsentRefusal(res.status, json) && askAiConsent && !retriedAfterConsent) {
      if (await askAiConsent()) return apiFetch<T>(path, options, true);
      throw new ApiError(403, AI_DECLINED_MESSAGE);
    }
    if (res.status === 401 && !skipAuth) {
      await clearToken();
      onUnauthorized?.();
    }
    const message =
      json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : `Request failed (${res.status}).`;
    const code = json && typeof json === "object" && "code" in json && typeof json.code === "string" ? json.code : null;
    throw new ApiError(res.status, message, code);
  }

  return json as T;
}

// For endpoints that stream plain text (the AI coach routes) rather than
// JSON. React Native's fetch doesn't reliably support reading a streamed
// response body chunk-by-chunk across platforms (Hermes' polyfill support
// is inconsistent), so this awaits the full text — no live token-by-token
// typing effect for now, but reliable everywhere. A streaming upgrade is a
// native-polish-phase item once this is running on real devices.
export async function apiFetchText(
  path: string,
  options: { body?: unknown } = {},
  retriedAfterConsent = false
): Promise<string> {
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
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON — keep the generic message.
    }
    if (isConsentRefusal(res.status, parsed) && askAiConsent && !retriedAfterConsent) {
      if (await askAiConsent()) return apiFetchText(path, options, true);
      throw new ApiError(403, AI_DECLINED_MESSAGE);
    }
    if (res.status === 401) {
      await clearToken();
      onUnauthorized?.();
    }
    let message = `Request failed (${res.status}).`;
    if (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string") message = parsed.message;
    throw new ApiError(res.status, message);
  }

  return text;
}
