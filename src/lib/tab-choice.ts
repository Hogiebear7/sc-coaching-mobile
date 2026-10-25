import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import type { ChoosableTab } from "@/lib/tab-config";

// The member's two chosen middle tabs, kept on the device (same pattern as
// the haptics switch in lib/haptics.ts). null = never chosen, so the bar
// uses the tier default. Every screen that reads it re-renders on a change.
const STORAGE_KEY = "sc.tabChoice";

let current: ChoosableTab[] | null = null;
const listeners = new Set<() => void>();

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      current = parsed.filter((t): t is ChoosableTab => t === "schedule" || t === "workouts" || t === "nutrition");
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

export function setTabChoice(choice: ChoosableTab[]) {
  current = [...choice];
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(choice)).catch(() => {});
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
