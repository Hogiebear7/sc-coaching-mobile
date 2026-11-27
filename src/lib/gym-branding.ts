import { useSyncExternalStore } from "react";

// The signed-in account's gym's own look, as the server reports it on the session check (GET /api/mobile/auth/me, server: lib/gym-branding.ts). A gym that has set
// nothing, and S&C itself, report `custom: false` and the app shows the S&C logo. Only an https image link is ever used as a logo.

export interface GymBranding {
  name: string;
  accentColor: string;
  onAccent: string;
  logoUrl: string | null;
  /** The colour the logo sits on at launch and in headers: the gym's choice, always a #RRGGBB (the app's navy unless the gym picked white or a colour of its own). */
  logoBackground: string;
  custom: boolean;
}

export const LOGO_BACKGROUND_DARK = "#0A1526";
export const LOGO_BACKGROUND_LIGHT = "#FFFFFF";

/** What the server sent as the logo background: a #RRGGBB, or (an older server) "light" or "dark". Anything else is the app's navy. */
export function parseLogoBackground(raw: unknown): string {
  if (raw === "light") return LOGO_BACKGROUND_LIGHT;
  if (typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  return LOGO_BACKGROUND_DARK;
}

export const DEFAULT_BRANDING: GymBranding = { name: "S&C Performance Coaching", accentColor: "#C9A24B", onAccent: "#0A1526", logoUrl: null, logoBackground: LOGO_BACKGROUND_DARK, custom: false };

let current: GymBranding = DEFAULT_BRANDING;
const listeners = new Set<() => void>();

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Cleans what the server sent (an older server sends nothing, which means the S&C default). */
export function parseBranding(raw: unknown): GymBranding {
  const r = raw as Partial<GymBranding> | null | undefined;
  if (!r || typeof r !== "object" || r.custom !== true) return DEFAULT_BRANDING;
  const logoUrl = typeof r.logoUrl === "string" && r.logoUrl.startsWith("https://") ? r.logoUrl : null;
  return {
    name: typeof r.name === "string" && r.name.trim() ? r.name : DEFAULT_BRANDING.name,
    accentColor: typeof r.accentColor === "string" && HEX.test(r.accentColor) ? r.accentColor : DEFAULT_BRANDING.accentColor,
    onAccent: typeof r.onAccent === "string" && HEX.test(r.onAccent) ? r.onAccent : DEFAULT_BRANDING.onAccent,
    logoUrl,
    logoBackground: parseLogoBackground(r.logoBackground),
    custom: true,
  };
}

export function setGymBranding(raw: unknown) {
  const next = parseBranding(raw);
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((l) => l());
}

export function resetGymBranding() {
  setGymBranding(null);
}

export function getGymBranding(): GymBranding {
  return current;
}

export function useGymBranding(): GymBranding {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}
