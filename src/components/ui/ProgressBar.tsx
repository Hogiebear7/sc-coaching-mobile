import { StyleSheet, View } from "react-native";

import { AppRadius } from "@/constants/theme";
import { makeStyles, useAppTheme } from "@/lib/theme";

// Thin horizontal progress bar under a label + value pair. Pass the
// metric's data colour (DataColor) as `color`; with none it uses the text
// ink rather than gold, which is now the brand mark only.
export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color ?? colors.text }]} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    track: {
      height: 6,
      borderRadius: AppRadius.control,
      backgroundColor: c.control,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: AppRadius.control,
    },
  })
);
