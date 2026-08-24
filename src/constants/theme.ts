// Ported 1:1 from the web app's navy/gold default (app/globals.css,
// [data-theme="navy"] + [data-palette="gold"]). React Native's style system
// doesn't support oklch(), so every value below is that same oklch color
// converted to sRGB hex — same visual result, RN-compatible format. The S&C
// brand is a fixed dark navy/gold identity (not light/dark adaptive), so
// this is the only theme — no system-appearance branching.

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

// Display face carries the brand's editorial-serif personality (used for
// headings/hero numbers on web); body stays a clean system sans for density
// and legibility at small sizes. No custom font files bundled yet — falls
// back to each platform's serif/sans system font until brand fonts are
// added as static assets.
export const Font = {
  display: "serif",
  body: "System",
  mono: "monospace",
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;
