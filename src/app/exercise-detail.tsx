import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PillButton, RangePills, SectionTitle } from "@/components/app/primitives";
import { TrendChart } from "@/components/ui/TrendChart";
import { AppRadius, AppSpace } from "@/constants/theme";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { useWorkouts } from "@/lib/queries/workouts";
import {
  EXERCISE_METRICS,
  TREND_RANGES,
  filterPointsByRange,
  formatDuration,
  getExerciseMetricTrend,
  getExerciseStats,
  todayDateString,
  type ExerciseMetricKey,
} from "@/lib/workout-formatters";
import { makeStyles, useAppTheme } from "@/lib/theme";

function formatShortDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function ExerciseDetailScreen() {
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();
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
  const activeMetricUnit = EXERCISE_METRICS.find((m) => m.key === activeMetric)?.unit ?? "";
  const formatTrendValue = (v: number) => (activeMetricUnit === "time" ? formatDuration(Math.round(v)) : `${v} ${activeMetricUnit}`);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {exerciseName || "Exercise"}
        </Text>
        <View style={styles.navBtn} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      ) : !stats || stats.sessionCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No logged history for this exercise yet.</Text>
          <PillButton title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Headline figures */}
          <View style={styles.stats}>
            <Figure label="Heaviest" value={stats.heaviestWeight ? stats.heaviestWeight.weightStr : "—"} />
            <Figure label="Est. 1RM" value={stats.estimatedOneRepMax ? `${stats.estimatedOneRepMax.value} kg` : "—"} />
            <Figure label="Sessions" value={String(stats.sessionCount)} />
          </View>

          <View style={styles.strip}>
            <StripItem color={dc.weight} label="Total volume" value={stats.totalVolume > 0 ? `${stats.totalVolume.toLocaleString()} kg` : "—"} />
            <StripItem color={dc.load} label="Total sets" value={String(stats.totalSets)} />
            <StripItem color={dc.sessions} label="Total reps" value={String(stats.totalReps)} />
          </View>

          {/* Trend */}
          <View style={styles.section}>
            <SectionTitle title="Trend" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {EXERCISE_METRICS.map((m) => {
                const active = activeMetric === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => {
                      if (!active) selectionFeedback();
                      setMetric(m.key);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.card}>
              <TrendChart points={filteredTrendPoints} formatValue={formatTrendValue} />
            </View>
            <View style={{ marginTop: 12 }}>
              <RangePills options={TREND_RANGES.map((r) => r.key)} value={trendRange} onChange={setTrendRange} />
            </View>
          </View>

          {/* History */}
          <View style={styles.section}>
            <SectionTitle title="History" />
            <View style={styles.list}>
              {stats.history.map((h, idx) => (
                <Pressable
                  key={`${h.sessionId}-${idx}`}
                  onPress={() => {
                    tapFeedback();
                    router.push({ pathname: "/session-detail", params: { id: h.sessionId } });
                  }}
                  style={({ pressed }) => [styles.row, idx > 0 && styles.rowDivider, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{formatShortDate(h.date)}</Text>
                    <Text style={styles.rowSub}>{h.summary || "—"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function StripItem({ label, value, color }: { label: string; value: string; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stripItem} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.stripValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.stripLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, height: 56 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navTitle: { flex: 1, fontSize: 20, fontWeight: "600", color: c.text, textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    muted: { fontSize: 16, color: c.textMuted, textAlign: "center" },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingBottom: 48 },
    stats: { flexDirection: "row", gap: 12, marginTop: 8 },
    figureLabel: { fontSize: 15, color: c.textMuted, marginBottom: 2 },
    figureValue: { fontSize: 28, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"] },
    strip: { flexDirection: "row", gap: AppSpace.gap, marginTop: 20 },
    stripItem: { flex: 1, backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 14 },
    dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
    stripValue: { fontSize: 20, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"] },
    stripLabel: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    section: { marginTop: AppSpace.section },
    chipRow: { gap: 8, paddingBottom: 12 },
    chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: AppRadius.control, backgroundColor: c.control, justifyContent: "center" },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 14, fontWeight: "500", color: c.text },
    chipTextActive: { color: c.onPrimary },
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16, alignItems: "center" },
    list: { backgroundColor: c.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    rowTitle: { fontSize: 16, color: c.text },
    rowSub: { fontSize: 14, color: c.textMuted, marginTop: 2 },
  })
);
