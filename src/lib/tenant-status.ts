import { useSyncExternalStore } from "react";

// Where the signed-in account's gym stands on its platform subscription with S&C (server: lib/tenant-lockout.ts). "active" is the normal case and the only
// one for most people. "grace" means the gym's payment is overdue and access will pause on `graceEndsOn` (only the gym's staff are shown this). "locked" means
// access is paused: the server answers every request with 423 and the app shows the unavailable screen. Nothing is deleted, and it all comes back when the gym pays.

export type TenantState = "active" | "grace" | "locked";

export interface TenantStatus {
  state: TenantState;
  graceEndsOn: string | null;
  graceDaysLeft: number | null;
  /** The gym's payment link, only ever sent to that gym's own staff. */
  payUrl: string | null;
}

export const TENANT_ACTIVE: TenantStatus = { state: "active", graceEndsOn: null, graceDaysLeft: null, payUrl: null };

export const TENANT_LOCKED_CODE = "tenant_locked";

let current: TenantStatus = TENANT_ACTIVE;
const listeners = new Set<() => void>();

function set(next: TenantStatus) {
  if (next.state === current.state && next.payUrl === current.payUrl && next.graceDaysLeft === current.graceDaysLeft && next.graceEndsOn === current.graceEndsOn) return;
  current = next;
  listeners.forEach((l) => l());
}

/** Cleans what the server sent (an older server sends nothing, which means active). */
export function parseTenantStatus(raw: unknown): TenantStatus {
  const r = raw as Partial<TenantStatus> | null | undefined;
  if (!r || typeof r !== "object") return TENANT_ACTIVE;
  const state: TenantState = r.state === "grace" || r.state === "locked" ? r.state : "active";
  if (state === "active") return TENANT_ACTIVE;
  return {
    state,
    graceEndsOn: typeof r.graceEndsOn === "string" ? r.graceEndsOn : null,
    graceDaysLeft: typeof r.graceDaysLeft === "number" ? r.graceDaysLeft : null,
    payUrl: typeof r.payUrl === "string" && r.payUrl.startsWith("https://") ? r.payUrl : null,
  };
}

export function setTenantStatus(raw: unknown) {
  set(parseTenantStatus(raw));
}

/** A 423 "tenant_locked" came back from any request: show the unavailable screen (keeping the pay link the session check gave us). */
export function markTenantLocked() {
  set({ ...current, state: "locked", graceEndsOn: null, graceDaysLeft: null });
}

export function resetTenantStatus() {
  set(TENANT_ACTIVE);
}

export function getTenantStatus(): TenantStatus {
  return current;
}

export function useTenantStatus(): TenantStatus {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}

/** "access pauses in 3 days" style wording for the staff banner. */
export function graceBannerText(status: TenantStatus): string {
  const days = status.graceDaysLeft;
  const when = days === null ? "soon" : days <= 1 ? "tomorrow" : `in ${days} days`;
  return `Your gym's platform payment is overdue. Access pauses ${when} unless it is paid.`;
}
