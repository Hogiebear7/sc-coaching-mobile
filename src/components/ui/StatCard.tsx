import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Spacing } from "@/constants/theme";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";

// The recurring "label / subtext / big value / thin bar" card seen
// throughout the reference app's Nutrition and Body Metrics screens —
// e.g. "Protein — Today — 0g [====----]". `progressPct` is optional: some
// stat cards (KPI strips) just show a number with no bar. `onInfoPress` is
// optional too: a small (i) affordance for stats whose meaning isn't
// self-evident (e.g. "7-Day Load"), opening an InfoModal — most stat cards
// don't need it.
export function StatCard({
  label,
  subtext,
  value,
  unit,
  progressPct,
  progressColor,
  onInfoPress,
}: {
  label: string;
  subtext?: string;
  value: string;
  unit?: string;
  progressPct?: number;
  progressColor?: string;
  onInfoPress?: () => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onInfoPress ? (
          <Pressable onPress={onInfoPress} hitSlop={10} style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={14} color={Color.textFaint} />
          </Pressable>
        ) : null}
      </View>
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
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Color.textMuted,
  },
  infoButton: { padding: 1 },
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
