// Ported 1:1 from the web app's navy/gold default (app/globals.css,
// [data-theme="navy"] + [data-palette="gold"]). React Native's style system
// doesn't support oklch(), so every value below is that same oklch color
// converted to sRGB hex — same visual result, RN-compatible format. The S&C
// brand started as a fixed dark navy/gold identity, and these legacy tokens
// remain the dark values. App v2 palettes (DarkPalette / LightPalette,
// below) are the themeable layer; see lib/theme.tsx.

import { Platform, type TextStyle } from "react-native";

export const Color = {
  // Surfaces. Dark values follow the App v2 near-black navy so legacy
  // screens and rebuilt ones sit on the same ground.
  bg0: "#060d18",
  surface1: "#0f1a2c",
  surface2: "#16243a",
  surface3: "#1d2d47",

  // Borders (white at fixed opacity). Deliberately soft: stacked on a phone
  // screen, crisp lines on every card/chip/row edge add up to visual noise.
  borderSubtle: "rgba(255,255,255,0.09)",
  borderDefault: "rgba(255,255,255,0.18)",

  // Text
  textPrimary: "#fcfeff",
  textSecondary: "rgba(255,255,255,0.8)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.5)",

  // Legacy "accent" slots. App v2 rule: actions are monochrome (white on
  // dark, navy on light) and gold is the brand mark only — so these keep
  // their old names for the screens that use them but now hold the
  // primary-ink values. Real gold lives in `brand`.
  gold: "#ffffff",
  goldHover: "#ffffff",
  goldForeground: "#0a1526",
  goldWeak: "rgba(255,255,255,0.10)",
  goldBorder: "rgba(255,255,255,0.28)",
  brand: "#c6a15b",
  brandWeak: "rgba(198,161,91,0.14)",

  // Semantic
  accentData: "#55c4fe",
  success: "#8fbf9f",
  successWeak: "rgba(143,191,159,0.14)",
  warning: "#e9b452",
  warningWeak: "rgba(233,180,82,0.14)",
  danger: "#e62b34",
  dangerWeak: "rgba(230,43,52,0.12)",

  // Neutral washes (were inline white-alpha literals)
  overlayFaint: "rgba(255,255,255,0.05)",
  overlayStrong: "rgba(255,255,255,0.12)",
};

export type LegacyPalette = { [K in keyof typeof Color]: string };

// The legacy palette for the current theme, updated in place by
// ThemeProvider. Only for module-level helpers that run during render but
// sit outside a component (status-colour lookups and the like); components
// use useLegacyColors() instead.
export const LiveColor: LegacyPalette = { ...Color };

// Light twin of the legacy tokens, key for key. Screens read these through
// makeLegacyStyles / useLegacyColors (lib/theme.tsx) so the whole app
// switches together.
export const ColorLight: LegacyPalette = {
  bg0: "#f3f5f9",
  surface1: "#ffffff",
  surface2: "#eaeef4",
  surface3: "#dde3ec",
  borderSubtle: "rgba(10,21,38,0.10)",
  borderDefault: "rgba(10,21,38,0.20)",
  textPrimary: "#0a1526",
  textSecondary: "rgba(10,21,38,0.78)",
  textMuted: "rgba(10,21,38,0.56)",
  textFaint: "rgba(10,21,38,0.58)",
  gold: "#0a1526",
  goldHover: "#0a1526",
  goldForeground: "#ffffff",
  goldWeak: "rgba(10,21,38,0.06)",
  goldBorder: "rgba(10,21,38,0.22)",
  brand: "#9c7631",
  brandWeak: "rgba(156,118,49,0.12)",
  accentData: "#1784c4",
  success: "#2e8a57",
  successWeak: "rgba(46,138,87,0.12)",
  warning: "#a86f0c",
  warningWeak: "rgba(168,111,12,0.12)",
  danger: "#c8323a",
  dangerWeak: "rgba(200,50,58,0.10)",
  overlayFaint: "rgba(10,21,38,0.04)",
  overlayStrong: "rgba(10,21,38,0.09)",
};

// Macro-nutrient color coding — protein/carbs/fat — deliberately distinct
// from Color.danger/success/gold so a macro chip never reads as an error
// state or blends into the gold accent everywhere else on screen. Shared
// across the nutrition pie chart, the macro legend, and diary entry rows.
export const MacroColor = {
  protein: "#d9635c",
  carbs: "#7fb98f",
  fat: "#e0924f",
} as const;

// App v2 soft geometry for the app (the website keeps its sharper 4px
// cards; see docs/design-inspiration-macrofactor-2026-10.md).
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
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
// Android clipping the tops of the glyphs. iOS lays the line box out
// differently and still clipped the tops at 1x (seen on iPhone), so it gets
// a taller line with the extra above the glyphs.
export function headline(size: number): TextStyle {
  return {
    fontFamily: Font.display,
    fontWeight: "600",
    fontSize: size,
    lineHeight: Platform.OS === "ios" ? Math.round(size * 1.2) : Math.round(size * 1.0),
    ...(Platform.OS === "ios" ? { paddingTop: Math.round(size * 0.12) } : null),
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
// Palettes. Dark is the default and the only one users see until Phase 2
// enables the Settings theme picker (see lib/theme.tsx). Every key exists in
// both so a component written against one works in the other. Light keeps
// the same jobs: navy ink as the primary action, gold only as the brand mark,
// and data hues darkened enough to hold 3:1 against a white card.
export type AppPalette = {
  bg: string;
  surface: string;
  surfaceHi: string;
  control: string;
  hairline: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  brand: string;
  danger: string;
  success: string;
  warning: string;
  scrim: string;
};

export const DarkPalette: AppPalette = {
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
  danger: "#f0646b",
  success: "#7ccf9d",
  warning: "#e9b452",
  scrim: "rgba(0,0,0,0.55)",
};

export const LightPalette: AppPalette = {
  bg: "#f3f5f9",
  surface: "#ffffff",
  surfaceHi: "#eaeef4",
  control: "#e3e8f0",
  hairline: "rgba(10,21,38,0.10)",
  text: "#0a1526",
  textSecondary: "rgba(10,21,38,0.74)",
  textMuted: "rgba(10,21,38,0.54)",
  primary: "#0a1526",
  onPrimary: "#ffffff",
  brand: "#9c7631",
  danger: "#c8323a",
  success: "#2e8a57",
  warning: "#a86f0c",
  scrim: "rgba(10,21,38,0.35)",
};

// Static dark alias for screens not yet reading the theme context.
export const AppColor = DarkPalette;

export type DataPalette = {
  readinessHigh: string;
  readinessMid: string;
  readinessLow: string;
  load: string;
  sleep: string;
  sessions: string;
  weight: string;
  hydration: string;
  protein: string;
  carbs: string;
  fat: string;
};

// One hue per metric, used on its tile, chart, legend and explainer.
export const DataColor: DataPalette = {
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
};

export const DataColorLight: DataPalette = {
  readinessHigh: "#2e9a5f",
  readinessMid: "#1784c4",
  readinessLow: "#b9790c",
  load: "#2c66d6",
  sleep: "#6352d6",
  sessions: "#cc5a26",
  weight: "#8f52c9",
  hydration: "#0f8ea3",
  protein: "#c24a43",
  carbs: "#3f8f58",
  fat: "#c7702a",
};

export function readinessColor(score: number | null, data: DataPalette = DataColor, muted = AppColor.textMuted): string {
  if (score === null) return muted;
  if (score >= 60) return data.readinessHigh;
  if (score >= 40) return data.readinessMid;
  return data.readinessLow;
}

export const AppRadius = { card: 16, control: 999, inner: 10 } as const;
export const AppSpace = { gutter: 16, gap: 10, section: 28 } as const;

// Screen title: the one loud Teko moment per screen.
export function appTitle(size = 34, color: string = AppColor.text): TextStyle {
  return { ...headline(size), letterSpacing: size * 0.02, color };
}

// Values: platform sans, regular weight, with a separately styled unit.
export function appValue(size = 26, color: string = AppColor.text): TextStyle {
  return { fontSize: size, fontWeight: "500", color, fontVariant: ["tabular-nums"] };
}
