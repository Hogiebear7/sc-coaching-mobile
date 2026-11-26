import type { AppPalette } from "@/constants/theme";
import { accentForScheme } from "@/lib/gym-accent";

// Colour-accent options for the app (owner request 2026-11-25: "a touch of subtle colour, like MacroFactor"). TEST BUILDS ONLY for now: the picker in Settings is
// hidden unless EXPO_PUBLIC_SEASON_PREVIEW is on, and the default, "none", is exactly how the app looks today. One accent is used in a few small places (the
// active tab and its dot, section links, the calorie bar), never as a card background, so the navy base and the macro and hydration colours stay as they are.

export type AccentVariant = "none" | "gold" | "areas" | "blue";

export const ACCENT_CHOICES: { key: AccentVariant; label: string; note: string }[] = [
  { key: "none", label: "A. As it is now", note: "Neutral, data colours only" },
  { key: "gold", label: "B. Gold", note: "Brand gold on tabs, links and calories" },
  { key: "areas", label: "C. By area", note: "Home blue, Train coral, Nutrition green" },
  { key: "blue", label: "D. Cool blue", note: "One soft blue throughout" },
];

export const ACCENT_STORAGE_KEY = "sc.accentPreview";

export function isAccentVariant(v: unknown): v is AccentVariant {
  return v === "none" || v === "gold" || v === "areas" || v === "blue";
}

// Tab route name -> its colour in the "By area" option.
const AREAS_DARK: Record<string, string> = { index: "#7fa8ff", schedule: "#b9a2ff", workouts: "#ef8a5b", nutrition: "#7ccf9d", recovery: "#f0a0c0", more: "#fcfeff" };
const AREAS_LIGHT: Record<string, string> = { index: "#2c66d6", schedule: "#6352d6", workouts: "#cc5a26", nutrition: "#2e8a57", recovery: "#b03a6a", more: "#0a1526" };

const cache = new Map<string, AppPalette>();

/** The palette with an accent applied. Cached so the same inputs always give the same object (styles are cached per palette). */
export function applyAccent(base: AppPalette, variant: AccentVariant, scheme: "dark" | "light", gymColour?: string | null): AppPalette {
  if (variant === "none") return base;
  const key = `${scheme}:${variant}:${gymColour ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const light = scheme === "light";
  // A gym with its own colour (lib/gym-accent.ts) uses it in place of the S&C gold: for the accent, the links and the brand dots and badges.
  const gym = variant === "gold" ? accentForScheme(gymColour, scheme) : null;
  const single = gym ?? (variant === "gold" ? (light ? "#9c7631" : "#c6a15b") : light ? "#2c66d6" : "#6fb1ff");
  const areas = variant === "areas" ? (light ? AREAS_LIGHT : AREAS_DARK) : {};
  const next: AppPalette = {
    ...base,
    accent: variant === "areas" ? base.text : single,
    accentLink: variant === "areas" ? (light ? "#2c66d6" : "#7fa8ff") : single,
    ...(gym ? { brand: gym } : {}),
    areas,
  };
  cache.set(key, next);
  return next;
}
