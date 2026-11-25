import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { SnowBox } from "@/components/season/SnowBox";

import { AppRadius } from "@/constants/theme";
import { makeStyles } from "@/lib/theme";

// App v2 card: a soft 16dp borderless surface (docs/design-inspiration-
// macrofactor-2026-10.md). Elevation is a background step, never a shadow
// or an outline.
//
// `tier` is the surface-hierarchy lever, so the one dominant module on a
// screen reads as more important than a footnote-level utility row.
// Elevation communicates that instead of colour; gold stays reserved for
// achievement signalling (see `accent`).
//   - hero: the one dominant module per screen — a surface step brighter.
//   - standard: the default.
//   - compact: secondary utility rows — same surface, tighter by convention.
//   - quiet: lowest-priority info — sits almost on the page background.
export type CardTier = "hero" | "standard" | "compact" | "quiet";

export function Card({
  children,
  style,
  accent = false,
  tier = "standard",
  snow = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  tier?: CardTier;
  /** False for the cards below the first in a stack, so only the top box wears snow. */
  snow?: boolean;
}) {
  const styles = useStyles();
  // SnowBox is a plain View except at Christmas, when the card wears snow on its top edge.
  return <SnowBox snow={snow} style={[styles.card, styles[tier], accent && styles.accent, style]}>{children}</SnowBox>;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      borderRadius: AppRadius.card,
      overflow: "hidden",
    },
    standard: { backgroundColor: c.surface },
    hero: { backgroundColor: c.surfaceHi },
    compact: { backgroundColor: c.surface },
    quiet: { backgroundColor: c.control },
    accent: {
      borderTopWidth: 2,
      borderTopColor: c.brand,
    },
  })
);
