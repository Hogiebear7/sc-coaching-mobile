import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

// One "N-day change" row: a small magnitude bar, a direction arrow, and the
// delta value — the building block of the Insights & Data section under a
// trend chart. `maxAbsDelta` is shared across every row in the same list so
// bar lengths stay comparable to each other rather than each maxing out its
// own scale.
export function ChangeInsightRow({
  label,
  delta,
  unit,
  maxAbsDelta,
}: {
  label: string;
  delta: number | null;
  unit: string;
  maxAbsDelta: number;
}) {
  if (delta === null) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.noData}>Not enough data</Text>
      </View>
    );
  }

  const isFlat = Math.abs(delta) < 0.05;
  const isUp = delta > 0;
  const fillFraction = maxAbsDelta > 0 ? Math.min(1, Math.abs(delta) / maxAbsDelta) : 0;
  const sign = isFlat ? "" : isUp ? "+" : "−";

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(fillFraction * 100, isFlat ? 0 : 6)}%` }]} />
      </View>
      <View style={styles.deltaWrap}>
        {!isFlat ? (
          <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={12} color={Color.gold} style={{ marginRight: 3 }} />
        ) : null}
        <Text style={styles.deltaText}>
          {isFlat ? "No change" : `${sign}${Math.abs(delta)} ${unit}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: 8 },
  label: { width: 48, fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  noData: { flex: 1, fontSize: 11, color: Color.textFaint, textAlign: "right" },
  barTrack: { flex: 1, height: 5, borderRadius: Radius.pill, backgroundColor: Color.surface2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: Radius.pill, backgroundColor: Color.gold },
  deltaWrap: { flexDirection: "row", alignItems: "center", minWidth: 68, justifyContent: "flex-end" },
  deltaText: { fontSize: 12, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
});
