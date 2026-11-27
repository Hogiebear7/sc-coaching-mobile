import { useSyncExternalStore } from "react";

// How members check in to classes at the signed-in account's gym, as the server reports it on the session check (GET /api/mobile/auth/me): "off", "poster" or "live".
// The "Scan to check in" button is only shown where the gym has turned it on. An older server sends nothing, which means off.

export type SelfCheckinMode = "off" | "poster" | "live";

export function parseSelfCheckin(raw: unknown): SelfCheckinMode {
  return raw === "poster" || raw === "live" ? raw : "off";
}

let current: SelfCheckinMode = "off";
const listeners = new Set<() => void>();

export function setSelfCheckin(raw: unknown) {
  const next = parseSelfCheckin(raw);
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

export function resetSelfCheckin() {
  setSelfCheckin("off");
}

export function getSelfCheckin(): SelfCheckinMode {
  return current;
}

export function useSelfCheckin(): SelfCheckinMode {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
  );
}
