import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendChart } from "@/components/ui/TrendChart";
import { WeightChangeInsights } from "@/components/ui/WeightChangeInsights";
import { WeightTrendChart } from "@/components/ui/WeightTrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useBodyWeightLogs } from "@/lib/queries/body-weight";
import { useWorkouts } from "@/lib/queries/workouts";
import {
  TREND_RANGES,
  filterPointsByRange,
  getExerciseContributions,
  getWeeklyTrend,
  todayDateString,
  type TrendPoint,
} from "@/lib/workout-formatters";

type Metric = "sets" | "volume";

function formatEntryDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function WorkoutTrendsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useWorkouts();
  const { data: weightLogs } = useBodyWeightLogs();
  const [metric, setMetric] = useState<Metric>("volume");
  const [range, setRange] = useState("3M");
  const [bwRange, setBwRange] = useState("All");

  const today = todayDateString();

  const weeklyTrend = useMemo(() => (data ? getWeeklyTrend(data.sessions) : []), [data]);

  const sortedWeightLogs = useMemo(
    () => (weightLogs ? [...weightLogs].sort((a, b) => a.date.localeCompare(b.date)) : []),
    [weightLogs]
  );
  const filteredWeightLogs = useMemo(
    () => filterPointsByRange(sortedWeightLogs, bwRange, today),
    [sortedWeightLogs, bwRange, today]
  );
  // Always computed from the FULL history, independent of the active range
  // filter — "since your first entry" should mean exactly that, not "since
  // the start of whatever window happens to be selected."
  const weightChangeSummary = useMemo(() => {
    if (sortedWeightLogs.length < 2) return null;
    const first = sortedWeightLogs[0];
    const latest = sortedWeightLogs[sortedWeightLogs.length - 1];
    const delta = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
    const direction = delta === 0 ? "No change" : delta > 0 ? `Up ${delta} kg` : `Down ${Math.abs(delta)} kg`;
    return `${direction} since your first entry (${formatEntryDate(first.date)})`;
  }, [sortedWeightLogs]);
  const filteredWeeks = useMemo(() => filterPointsByRange(weeklyTrend, range, today), [weeklyTrend, range, today]);

  const chartPoints: TrendPoint[] = useMemo(
    () =>
      filteredWeeks.map((w) => ({
        date: w.date,
        value: metric === "volume" ? w.totalVolume : w.totalSets,
        label: metric === "volume" ? (w.totalVolume > 0 ? `${Math.round(w.totalVolume / 1000)}k` : "0") : String(w.totalSets),
      })),
    [filteredWeeks, metric]
  );

  const rangeTotal = useMemo(
    () => filteredWeeks.reduce((sum, w) => sum + (metric === "volume" ? w.totalVolume : w.totalSets), 0),
    [filteredWeeks, metric]
  );
  const rangeWorkouts = useMemo(() => filteredWeeks.reduce((sum, w) => sum + w.workoutCount, 0), [filteredWeeks]);

  const topExercises = useMemo(() => {
    if (!data) return [];
    return getExerciseContributions(data.sessions, range, today)
      .sort((a, b) => b[metric] - a[metric])
      .filter((c) => c[metric] > 0)
      .slice(0, 5);
  }, [data, range, today, metric]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Training Trends</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>Couldn&apos;t load your trends.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : weeklyTrend.length === 0 ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card tier="quiet">
            <EmptyState
              icon="trending-up-outline"
              title="No workouts logged yet"
              body="Log a few workouts to see sets, volume, and top-exercise trends here."
            />
          </Card>
          <Text style={styles.sectionLabel}>BODYWEIGHT</Text>
          {sortedWeightLogs.length < 2 ? (
            <Card tier="quiet">
              <EmptyState
                icon="body-outline"
                title="No weight trend yet"
                body="Log a couple of weight check-ins in Nutrition to see your bodyweight trend here."
              />
            </Card>
          ) : (
            <>
              <View style={styles.rangeRow}>
                {TREND_RANGES.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => setBwRange(r.key)}
                    style={[styles.rangeChip, bwRange === r.key && styles.rangeChipActive]}
                  >
                    <Text style={[styles.rangeChipText, bwRange === r.key && styles.rangeChipTextActive]}>{r.key}</Text>
                  </Pressable>
                ))}
              </View>
              {weightChangeSummary ? <Text style={styles.chartCaption}>{weightChangeSummary}</Text> : null}
              <Card style={styles.trendCard}>
                <WeightTrendChart logs={filteredWeightLogs.map((l) => ({ date: l.date, value: l.weightKg }))} />
                <WeightChangeInsights logs={sortedWeightLogs} />
              </Card>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.metricToggleRow}>
            <Pressable
              onPress={() => setMetric("sets")}
              style={[styles.metricToggle, metric === "sets" && styles.metricToggleActive]}
            >
              <Text style={[styles.metricToggleText, metric === "sets" && styles.metricToggleTextActive]}>Sets</Text>
            </Pressable>
            <Pressable
              onPress={() => setMetric("volume")}
              style={[styles.metricToggle, metric === "volume" && styles.metricToggleActive]}
            >
              <Text style={[styles.metricToggleText, metric === "volume" && styles.metricToggleTextActive]}>Volume</Text>
            </Pressable>
          </View>

          <View style={styles.rangeRow}>
            {TREND_RANGES.filter((r) => r.key !== "All" || weeklyTrend.length > 1).map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
              >
                <Text style={[styles.rangeChipText, range === r.key && styles.rangeChipTextActive]}>{r.key}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                {metric === "volume" ? `${rangeTotal.toLocaleString()} kg` : rangeTotal.toLocaleString()}
              </Text>
              <Text style={styles.summaryLabel}>total {metric}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{rangeWorkouts}</Text>
              <Text style={styles.summaryLabel}>workouts</Text>
            </View>
          </View>

          <Card style={styles.trendCard}>
            <TrendChart
              points={chartPoints}
              formatValue={(v) => (metric === "volume" ? `${Math.round(v).toLocaleString()} kg` : `${Math.round(v)} sets`)}
            />
          </Card>
          <Text style={styles.chartCaption}>Weekly {metric === "volume" ? "volume (kg)" : "sets"}, week starting shown</Text>

          {topExercises.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>TOP EXERCISES THIS RANGE</Text>
              <Card style={styles.list}>
                {topExercises.map((ex, idx) => (
                  <Pressable
                    key={ex.name}
                    onPress={() => router.push({ pathname: "/exercise-detail", params: { name: ex.name } })}
                    style={[styles.row, idx > 0 && styles.rowDivider]}
                  >
                    <Text style={styles.rowName}>{ex.name}</Text>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowValue}>
                        {metric === "volume" ? `${ex.volume.toLocaleString()} kg` : `${ex.sets} sets`}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
                    </View>
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}

          <Text style={styles.sectionLabel}>BODYWEIGHT</Text>
          {sortedWeightLogs.length < 2 ? (
            <Card tier="quiet">
              <EmptyState
                icon="body-outline"
                title="No weight trend yet"
                body="Log a couple of weight check-ins in Nutrition to see your bodyweight trend here."
              />
            </Card>
          ) : (
            <>
              <View style={styles.rangeRow}>
                {TREND_RANGES.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => setBwRange(r.key)}
                    style={[styles.rangeChip, bwRange === r.key && styles.rangeChipActive]}
                  >
                    <Text style={[styles.rangeChipText, bwRange === r.key && styles.rangeChipTextActive]}>{r.key}</Text>
                  </Pressable>
                ))}
              </View>
              {weightChangeSummary ? <Text style={styles.chartCaption}>{weightChangeSummary}</Text> : null}
              <Card style={styles.trendCard}>
                <WeightTrendChart logs={filteredWeightLogs.map((l) => ({ date: l.date, value: l.weightKg }))} />
                <WeightChangeInsights logs={sortedWeightLogs} />
              </Card>
            </>
          )}
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
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  metricToggleRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  metricToggle: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  metricToggleActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  metricToggleText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  metricToggleTextActive: { color: Color.gold },
  rangeRow: { flexDirection: "row", gap: 6, marginTop: Spacing.md },
  rangeChip: { flex: 1, alignItems: "center", borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingVertical: 5 },
  rangeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  rangeChipText: { fontSize: 10, fontWeight: "600", color: Color.textMuted },
  rangeChipTextActive: { color: Color.gold },
  summaryRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  summaryStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  summaryValue: { fontSize: 20, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  summaryLabel: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  trendCard: { padding: Spacing.md, alignItems: "center", marginTop: Spacing.md },
  chartCaption: { fontSize: 11, color: Color.textFaint, textAlign: "center", marginTop: Spacing.xs },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  list: { padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  rowName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, flex: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowValue: { fontSize: 13, color: Color.textSecondary },
});
