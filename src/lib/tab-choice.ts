import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

import { apiFetch } from "@/lib/api-client";
import type { ChoosableTab } from "@/lib/tab-config";

// The member's two chosen middle tabs. Kept on the device so the bar draws
// instantly (same pattern as the haptics switch), and on the member's
// account (/api/mobile/app-preferences) so it follows them to a new phone.
// null = never chosen, so the bar uses the tier default.
const STORAGE_KEY = "sc.tabChoice";
const ROUTE = "/api/mobile/app-preferences";

let current: ChoosableTab[] | null = null;
const listeners = new Set<() => void>();

function isTab(t: unknown): t is ChoosableTab {
  return t === "schedule" || t === "workouts" || t === "nutrition";
}

function setLocal(choice: ChoosableTab[] | null) {
  current = choice ? [...choice] : null;
  listeners.forEach((l) => l());
  if (choice) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(choice)).catch(() => {});
}

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw || current) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) setLocal(parsed.filter(isTab));
  })
  .catch(() => {});

// Saves on the device and, best effort, on the account. A server without the
// route (older deploy) or no connection just leaves it device-only.
export function setTabChoice(choice: ChoosableTab[]) {
  setLocal(choice);
  apiFetch(ROUTE, { method: "POST", body: { tabChoice: choice } }).catch(() => {});
}

export function useTabChoice(): ChoosableTab[] | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}

// Once per signed-in session: the account's choice wins (it may have been set
// on another phone); if the account has none yet, this phone's choice is
// copied up to it.
export function useSyncTabChoiceWithAccount() {
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ success: true; data: { tabChoice: unknown } }>(ROUTE)
      .then((r) => {
        if (cancelled) return;
        const remote = Array.isArray(r.data.tabChoice) ? r.data.tabChoice.filter(isTab) : null;
        if (remote && remote.length === 2) setLocal(remote);
        else if (current && current.length === 2) apiFetch(ROUTE, { method: "POST", body: { tabChoice: current } }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
}
