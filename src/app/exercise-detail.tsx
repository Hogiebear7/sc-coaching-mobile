import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { TrendChart } from "@/components/ui/TrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/lib/queries/workouts";
import {
  EXERCISE_METRICS,
  TREND_RANGES,
  filterPointsByRange,
  getExerciseMetricTrend,
  getExerciseStats,
  todayDateString,
  type ExerciseMetricKey,
} from "@/lib/workout-formatters";

function formatShortDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { data, isLoading } = useWorkouts();
  const [trendRange, setTrendRange] = useState("All");
  const [metric, setMetric] = useState<ExerciseMetricKey | null>(null);

  const exerciseName = name ?? "";
  const today = todayDateString();

  const stats = useMemo(
    () => (data ? getExerciseStats(data.sessions, exerciseName) : null),
    [data, exerciseName]
  );

  // Default to whichever metric actually has data — most exercises are
  // weight-based, but a reps-only/bodyweight exercise defaults to reps
  // instead of an empty "Heaviest" chart.
  const activeMetric: ExerciseMetricKey = metric ?? (stats?.heaviestWeight ? "heaviestWeight" : "totalReps");

  const trendPoints = useMemo(
    () => (data ? getExerciseMetricTrend(data.sessions, exerciseName, activeMetric) : []),
    [data, exerciseName, activeMetric]
  );
  const filteredTrendPoints = useMemo(
    () => filterPointsByRange(trendPoints, trendRange, today),
    [trendPoints, trendRange, today]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {exerciseName || "Exercise"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : !stats || stats.sessionCount === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No logged history for this exercise yet.</Text>
          <Button title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard label="HEAVIEST" value={stats.heaviestWeight ? stats.heaviestWeight.weightStr : "—"} />
              <StatCard label="EST. 1RM" value={stats.estimatedOneRepMax ? `${stats.estimatedOneRepMax.value} kg` : "—"} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="TOTAL VOLUME" value={stats.totalVolume > 0 ? `${stats.totalVolume.toLocaleString()} kg` : "—"} />
              <StatCard label="SESSIONS" value={String(stats.sessionCount)} />
            </View>
          </View>

          <Card style={styles.secondaryRow}>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{stats.totalSets}</Text>
              <Text style={styles.secondaryLabel}>total sets</Text>
            </View>
            <View style={styles.secondaryDivider} />
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{stats.totalReps}</Text>
              <Text style={styles.secondaryLabel}>total reps</Text>
            </View>
            <View style={styles.secondaryDivider} />
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{stats.bestSetReps ? stats.bestSetReps.reps : "—"}</Text>
              <Text style={styles.secondaryLabel}>best set reps</Text>
            </View>
          </Card>

          <Text style={styles.sectionLabel}>TREND</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricPicker} contentContainerStyle={{ gap: Spacing.xs }}>
            {EXERCISE_METRICS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setMetric(m.key)}
                style={[styles.metricChip, activeMetric === m.key && styles.metricChipActive]}
              >
                <Text style={[styles.metricChipText, activeMetric === m.key && styles.metricChipTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.rangeRow}>
            {TREND_RANGES.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setTrendRange(r.key)}
                style={[styles.rangeChip, trendRange === r.key && styles.rangeChipActive]}
              >
                <Text style={[styles.rangeChipText, trendRange === r.key && styles.rangeChipTextActive]}>{r.key}</Text>
              </Pressable>
            ))}
          </View>
          <Card style={styles.trendCard}>
            <TrendChart points={filteredTrendPoints} />
          </Card>

          <Text style={styles.sectionLabel}>HISTORY</Text>
          <Card style={styles.list}>
            {stats.history.map((h, idx) => (
              <Pressable
                key={`${h.sessionId}-${idx}`}
                onPress={() => router.push({ pathname: "/session-detail", params: { id: h.sessionId } })}
                style={[styles.row, idx > 0 && styles.rowDivider]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowDate}>{formatShortDate(h.date)}</Text>
                  <Text style={styles.rowSummary}>{h.summary || "—"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
              </Pressable>
            ))}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: Color.textPrimary, marginHorizontal: Spacing.sm },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  statsGrid: { gap: Spacing.sm, marginTop: Spacing.sm },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  secondaryRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginTop: Spacing.sm },
  secondaryStat: { flex: 1, alignItems: "center" },
  secondaryDivider: { width: 1, height: 28, backgroundColor: Color.borderSubtle },
  secondaryValue: { fontSize: 16, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  secondaryLabel: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  metricPicker: { marginBottom: Spacing.sm },
  metricChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  metricChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  metricChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  metricChipTextActive: { color: Color.gold },
  rangeRow: { flexDirection: "row", gap: 6, marginBottom: Spacing.sm },
  rangeChip: { flex: 1, alignItems: "center", borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingVertical: 5 },
  rangeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  rangeChipText: { fontSize: 10, fontWeight: "600", color: Color.textMuted },
  rangeChipTextActive: { color: Color.gold },
  trendCard: { padding: Spacing.md, alignItems: "center" },
  list: { padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  rowDate: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  rowSummary: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
});
