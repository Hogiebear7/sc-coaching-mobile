// Ported 1:1 from the web app's navy/gold default (app/globals.css,
// [data-theme="navy"] + [data-palette="gold"]). React Native's style system
// doesn't support oklch(), so every value below is that same oklch color
// converted to sRGB hex — same visual result, RN-compatible format. The S&C
// brand is a fixed dark navy/gold identity (not light/dark adaptive), so
// this is the only theme — no system-appearance branching.

import type { TextStyle } from "react-native";

export const Color = {
  // Surfaces
  bg0: "#0a1526",
  surface1: "#10203a",
  surface2: "#142b4a",
  surface3: "#24405f",

  // Borders (white at fixed opacity). Deliberately softer than the web
  // app's literal values — web's borders sit against a much larger canvas
  // where a crisper line reads as structure; stacked on a phone screen,
  // the same weight repeated across every card/chip/row edge added up to
  // visual noise, so these run about a third lighter than their web
  // equivalents (borderSubtle) or a fifth lighter (borderDefault, which
  // still needs to read as a clear step up for hero cards/active states).
  borderSubtle: "rgba(255,255,255,0.11)",
  borderDefault: "rgba(255,255,255,0.22)",

  // Text
  textPrimary: "#fcfeff",
  textSecondary: "rgba(255,255,255,0.8)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.35)",

  // Gold accent (primary)
  gold: "#c6a15b",
  goldHover: "#e0be7c",
  goldForeground: "#0a1526",
  goldWeak: "rgba(198,161,91,0.12)",
  goldBorder: "rgba(224,190,124,0.45)",

  // Semantic
  accentData: "#55c4fe",
  success: "#8fbf9f",
  successWeak: "rgba(143,191,159,0.14)",
  warning: "#e9b452",
  warningWeak: "rgba(233,180,82,0.14)",
  danger: "#e62b34",
  dangerWeak: "rgba(230,43,52,0.12)",
} as const;

// Macro-nutrient color coding — protein/carbs/fat — deliberately distinct
// from Color.danger/success/gold so a macro chip never reads as an error
// state or blends into the gold accent everywhere else on screen. Shared
// across the nutrition pie chart, the macro legend, and diary entry rows.
export const MacroColor = {
  protein: "#d9635c",
  carbs: "#7fb98f",
  fat: "#e0924f",
} as const;

// Editorial, slightly-sharp corners — the web app deliberately uses 4px
// radii on cards (surface-card), not the generic rounded-2xl look.
export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Display face is Teko, matching the website (gym-app DESIGN.md): headings and
// big figures only, embedded at build time by the expo-font config plugin in
// app.json (static 600/700 files — SDK 57 has no variable-font support). Body
// text deliberately stays the platform sans (SF Pro / Roboto), which is close
// enough to the website's Inter at body sizes; see DESIGN.md "Known gaps".
export const Font = {
  display: "Teko",
  body: "System",
  mono: "monospace",
} as const;

// Uppercase Teko headline, the website's `text-headline`. Teko's capitals sit
// tall, so lineHeight stays at 1x the size rather than the web's 0.9 to avoid
// Android clipping the tops of the glyphs.
export function headline(size: number): TextStyle {
  return {
    fontFamily: Font.display,
    fontWeight: "600",
    fontSize: size,
    lineHeight: Math.round(size * 1.0),
    letterSpacing: size * 0.01,
    textTransform: "uppercase",
  };
}

// Teko figure for big numbers (stats, rings, timers): same face, not
// uppercased, even-width digits so ticking clocks don't jitter.
export function figure(size: number, weight: "600" | "700" = "600"): TextStyle {
  return {
    fontFamily: Font.display,
    fontWeight: weight,
    fontSize: size,
    lineHeight: Math.round(size * 1.05),
    fontVariant: ["tabular-nums"],
  };
}

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

// ─── App v2 tokens (prototype, docs/design-inspiration-macrofactor-2026-10.md)
// Chrome and data are separate jobs. Chrome is near-monochrome navy-black
// with WHITE as the primary action; gold is the brand mark only (logo,
// current tab, celebrations). Colour otherwise appears only on data, one hue
// per metric everywhere it shows. Soft geometry: 16dp borderless cards,
// pill controls, 48dp round icon buttons.
export const AppColor = {
  bg: "#060d18",
  surface: "#0f1a2c",
  surfaceHi: "#16243a",
  control: "#1d2d47",
  hairline: "rgba(255,255,255,0.08)",
  text: "#fcfeff",
  textSecondary: "rgba(255,255,255,0.72)",
  textMuted: "rgba(255,255,255,0.5)",
  primary: "#ffffff",
  onPrimary: "#0a1526",
  brand: "#c6a15b",
} as const;

// One hue per metric, used on its tile, chart, legend and explainer.
export const DataColor = {
  readinessHigh: "#7ccf9d",
  readinessMid: "#55c4fe",
  readinessLow: "#e9b452",
  load: "#5b9dff",
  sleep: "#9a8cff",
  sessions: "#ef8a5b",
  weight: "#c08cf0",
  hydration: "#4fd3e3",
  protein: MacroColor.protein,
  carbs: MacroColor.carbs,
  fat: MacroColor.fat,
} as const;

export function readinessColor(score: number | null): string {
  if (score === null) return AppColor.textMuted;
  if (score >= 60) return DataColor.readinessHigh;
  if (score >= 40) return DataColor.readinessMid;
  return DataColor.readinessLow;
}

export const AppRadius = { card: 16, control: 999, inner: 10 } as const;
export const AppSpace = { gutter: 16, gap: 10, section: 28 } as const;

// Screen title: the one loud Teko moment per screen.
export function appTitle(size = 34): TextStyle {
  return { ...headline(size), letterSpacing: size * 0.02, color: AppColor.text };
}

// Values: platform sans, regular weight, with a separately styled unit.
export function appValue(size = 26): TextStyle {
  return { fontSize: size, fontWeight: "500", color: AppColor.text, fontVariant: ["tabular-nums"] };
}
