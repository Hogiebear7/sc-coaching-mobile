import { StyleSheet, Text, View } from "react-native";

import { Color, Spacing } from "@/constants/theme";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";

// The recurring "label / subtext / big value / thin bar" card seen
// throughout the reference app's Nutrition and Body Metrics screens —
// e.g. "Protein — Today — 0g [====----]". `progressPct` is optional: some
// stat cards (KPI strips) just show a number with no bar.
export function StatCard({
  label,
  subtext,
  value,
  unit,
  progressPct,
  progressColor,
}: {
  label: string;
  subtext?: string;
  value: string;
  unit?: string;
  progressPct?: number;
  progressColor?: string;
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {progressPct !== undefined ? (
        <View style={styles.barWrap}>
          <ProgressBar pct={progressPct} color={progressColor} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Color.textMuted,
  },
  subtext: {
    fontSize: 11,
    color: Color.textFaint,
    marginTop: 2,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: Spacing.xs,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    color: Color.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 12,
    color: Color.textSecondary,
    marginLeft: 3,
  },
  barWrap: {
    marginTop: Spacing.sm,
  },
});
