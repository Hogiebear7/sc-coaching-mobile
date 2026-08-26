import { StyleSheet, Text, View } from "react-native";

import { ChangeInsightRow } from "@/components/ui/ChangeInsightRow";
import { Color, Spacing } from "@/constants/theme";
import type { BodyWeightLog } from "@/lib/queries/body-weight";
import { changeOverDays, type TrendPoint } from "@/lib/workout-formatters";

// "Insights & Data" section under the weight-trend chart — 3-day and 7-day
// change rows, always computed from the FULL log history regardless of
// whichever range chip is active on the chart above, since "in the last 3
// days" should mean exactly that.
export function WeightChangeInsights({ logs }: { logs: BodyWeightLog[] }) {
  const points: TrendPoint[] = logs.map((l) => ({ date: l.date, value: l.weightKg }));
  const threeDay = changeOverDays(points, 3);
  const sevenDay = changeOverDays(points, 7);

  if (!threeDay && !sevenDay) return null;

  const maxAbsDelta = Math.max(Math.abs(threeDay?.deltaValue ?? 0), Math.abs(sevenDay?.deltaValue ?? 0));

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>INSIGHTS & DATA</Text>
      <Text style={styles.subTitle}>Weight Changes</Text>
      <ChangeInsightRow label="3-day" delta={threeDay?.deltaValue ?? null} unit="kg" maxAbsDelta={maxAbsDelta} />
      <ChangeInsightRow label="7-day" delta={sevenDay?.deltaValue ?? null} unit="kg" maxAbsDelta={maxAbsDelta} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", marginTop: Spacing.lg },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  subTitle: { fontSize: 13, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.sm, marginBottom: 2 },
});
