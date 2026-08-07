import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Color, Radius } from "@/constants/theme";

// Mirrors the web app's .surface-card utility: surface-1 background, a
// barely-visible border (no shadows — elevation comes from the border/
// background step, matching the reference apps' flat, borderless-shadow
// card language), sharp-ish 4px corners rather than the generic rounded-2xl.
export function Card({
  children,
  style,
  accent = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
}) {
  return (
    <View style={[styles.card, accent && styles.accent, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.surface1,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  accent: {
    borderTopWidth: 2,
    borderTopColor: Color.gold,
  },
});
