import { StyleSheet, View } from "react-native";

import { Color, Radius } from "@/constants/theme";

// Thin horizontal progress bar — the signature stat-card element in the
// reference app (App Inspo folder: Nutrition/Body Metrics screens all use
// this under a label+value pair rather than a numeric badge).
export function ProgressBar({ pct, color = Color.gold }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
});
