import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";

// The recurring "label / subtext / big value / thin bar" card — e.g.
// "Protein — Today — 0g [====----]". `progressPct` is optional: some stat
// cards (KPI strips) just show a number with no bar. `onInfoPress` is
// optional too: a small (i) affordance for stats whose meaning isn't
// self-evident (e.g. "7-Day Load"), opening an InfoModal.
//
// App v2: title in sentence case, the value in the platform sans with a
// separately styled unit (matching MetricTile), no uppercase micro-labels.
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
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {onInfoPress ? (
          <Pressable onPress={onInfoPress} hitSlop={12} style={styles.infoButton} accessibilityRole="button" accessibilityLabel={`About ${label}`}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      padding: Spacing.lg,
      flex: 1,
    },
    labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    label: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: "500",
      color: c.text,
    },
    infoButton: { padding: 1 },
    subtext: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: 2,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: Spacing.sm,
    },
    value: {
      fontSize: 24,
      fontWeight: "500",
      color: c.text,
      fontVariant: ["tabular-nums"],
    },
    unit: {
      fontSize: 14,
      color: c.textSecondary,
      marginLeft: 4,
    },
    barWrap: {
      marginTop: Spacing.sm,
    },
  })
);
