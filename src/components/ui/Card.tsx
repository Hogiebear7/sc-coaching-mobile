import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Color, Radius } from "@/constants/theme";

// Mirrors the web app's .surface-card utility: surface-1 background, a
// barely-visible border (no shadows — elevation comes from the border/
// background step, matching the reference apps' flat, borderless-shadow
// card language), sharp-ish 4px corners rather than the generic rounded-2xl.
//
// `tier` is the surface-hierarchy lever: every screen used to reach for a
// bare <Card> regardless of whether it held the one dominant module on the
// screen or a footnote-level utility row, so nothing ever looked more or
// less important than anything else. Elevation communicates that instead
// of color, since gold stays reserved for actionable/active/achievement
// signaling (see `accent`) rather than being spent on "this card matters."
//   - hero: the one dominant module per screen (readiness, today's
//     workout, calorie summary) — bumped a surface step brighter.
//   - standard: the default, unchanged from before this prop existed.
//   - compact: secondary utility rows (tools row, nav-list rows) — a
//     quieter border signals "lightweight," not "primary content."
//   - quiet: lowest-priority secondary info — no border at all, just a
//     faint background wash so it barely reads as a card.
export type CardTier = "hero" | "standard" | "compact" | "quiet";

export function Card({
  children,
  style,
  accent = false,
  tier = "standard",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  tier?: CardTier;
}) {
  return (
    <View style={[styles.card, styles[tier], accent && styles.accent, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  standard: {
    backgroundColor: Color.surface1,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  hero: {
    backgroundColor: Color.surface2,
    borderWidth: 1,
    borderColor: Color.borderDefault,
  },
  compact: {
    backgroundColor: Color.surface1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quiet: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0,
  },
  accent: {
    borderTopWidth: 2,
    borderTopColor: Color.gold,
  },
});
