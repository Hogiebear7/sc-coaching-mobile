import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// The gym logo remembered from the last session, so the next launch can fade from the S&C splash into the member's own gym logo before the app opens. At launch the app does not know
// who is signed in yet, so it uses what it saw last time: written whenever the server reports a gym with its own logo, cleared when there is none and on sign-out.
// Only an https logo is ever kept.

export interface GymSplash {
  logoUrl: string;
  name: string;
  /** The background colour the gym chose for its logo, a #RRGGBB. */
  background: string;
}

const KEY = "gym.splash.v1";

/** Reads what was saved. Anything that is not a name and an https logo link is ignored. */
export function parseGymSplash(raw: unknown): GymSplash | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const r = value as Partial<GymSplash> | null | undefined;
  if (!r || typeof r !== "object") return null;
  if (typeof r.logoUrl !== "string" || !r.logoUrl.startsWith("https://")) return null;
  return { logoUrl: r.logoUrl, name: typeof r.name === "string" && r.name.trim() ? r.name : "Your gym", background: typeof r.background === "string" && /^#[0-9a-fA-F]{6}$/.test(r.background) ? r.background.toUpperCase() : r.background === "light" ? "#FFFFFF" : "#0A1526" };
}

/** What to remember for a branding the server reported: the gym's own logo, or nothing when the gym has no logo of its own (or is S&C). */
export function splashFromBranding(branding: { custom: boolean; logoUrl: string | null; name: string; logoBackground?: string }): GymSplash | null {
  return branding.custom && branding.logoUrl ? parseGymSplash({ logoUrl: branding.logoUrl, name: branding.name, background: branding.logoBackground }) : null;
}

// undefined = not read from storage yet.
let current: GymSplash | null | undefined;
const listeners = new Set<() => void>();

function set(next: GymSplash | null) {
  if (JSON.stringify(current) === JSON.stringify(next)) return;
  current = next;
  listeners.forEach((l) => l());
}

/** Starts reading the saved logo as early as possible (called when this file is first loaded) so it is ready by the time the splash is on screen. */
void AsyncStorage.getItem(KEY)
  .then((raw) => set(parseGymSplash(raw)))
  .catch(() => set(null));

export function rememberGymSplash(next: GymSplash | null) {
  set(next);
  const write = next ? AsyncStorage.setItem(KEY, JSON.stringify(next)) : AsyncStorage.removeItem(KEY);
  void write.catch(() => undefined);
}

/** The remembered gym logo, null when there is none, undefined until storage has been read. */
export function useGymSplash(): GymSplash | null | undefined {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
  );
}
