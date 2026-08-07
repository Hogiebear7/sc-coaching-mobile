import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TrendChart } from "@/components/ui/TrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/lib/queries/workouts";
import { formatExerciseLoad, formatRun, getExerciseTrend } from "@/lib/workout-formatters";

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useWorkouts();
  const [trendExercise, setTrendExercise] = useState<string | null>(null);

  // Exercises with at least 2 logged dates — the only ones a trend chart
  // can say anything about. Most-recently-logged first.
  const trendCandidates = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>(); // name -> most recent date
    for (const s of data.sessions) {
      for (const ex of s.exercises) {
        const key = ex.name.trim().toLowerCase();
        if (!key) continue;
        const existing = seen.get(key);
        if (!existing || s.date > existing) seen.set(key, s.date);
      }
    }
    return [...seen.entries()]
      .map(([key, date]) => ({ key, date, name: data.sessions.flatMap((s) => s.exercises).find((e) => e.name.trim().toLowerCase() === key)?.name ?? key }))
      .filter((c) => getExerciseTrend(data.sessions, c.name).length >= 2)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const activeTrendExercise = trendExercise ?? trendCandidates[0]?.name ?? null;
  const trendPoints = data && activeTrendExercise ? getExerciseTrend(data.sessions, activeTrendExercise) : [];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your workouts.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Workouts</Text>
          <Pressable onPress={() => router.push("/log-workout")} style={styles.logButton}>
            <Ionicons name="add" size={18} color={Color.goldForeground} />
            <Text style={styles.logButtonText}>Log</Text>
          </Pressable>
        </View>

        <View style={styles.toolsRow}>
          <Pressable onPress={() => router.push("/plate-calculator")} style={styles.toolCard}>
            <Ionicons name="barbell-outline" size={18} color={Color.gold} />
            <Text style={styles.toolCardText}>Plate Calculator</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/rest-timer", params: { seconds: "90" } })} style={styles.toolCard}>
            <Ionicons name="timer-outline" size={18} color={Color.gold} />
            <Text style={styles.toolCardText}>Rest Timer</Text>
          </Pressable>
        </View>

        {data.personalBests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PERSONAL BESTS</Text>
            {data.personalBests.map((pb) => (
              <Card key={pb.exerciseName} style={styles.pbCard}>
                <Text style={styles.pbTitle}>{pb.exerciseName}</Text>
                <View style={styles.pbRow}>
                  {pb.heaviestWeight ? (
                    <View style={styles.pbStat}>
                      <Text style={styles.pbValue}>{pb.heaviestWeight.weightStr}</Text>
                      <Text style={styles.pbLabel}>
                        heaviest{pb.heaviestWeight.reps ? ` · ${pb.heaviestWeight.reps} reps` : ""}
                      </Text>
                    </View>
                  ) : null}
                  {pb.highestReps ? (
                    <View style={styles.pbStat}>
                      <Text style={styles.pbValue}>{pb.highestReps.reps}</Text>
                      <Text style={styles.pbLabel}>best reps</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}

        {trendCandidates.length > 0 && activeTrendExercise ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PROGRESSION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendPicker} contentContainerStyle={{ gap: Spacing.xs }}>
              {trendCandidates.slice(0, 10).map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => setTrendExercise(c.name)}
                  style={[styles.trendChip, activeTrendExercise === c.name && styles.trendChipActive]}
                >
                  <Text style={[styles.trendChipText, activeTrendExercise === c.name && styles.trendChipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Card style={styles.trendCard}>
              <TrendChart points={trendPoints} />
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SESSION HISTORY</Text>
          {data.sessions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={22} color={Color.textFaint} />
              <Text style={styles.emptyText}>No workouts logged yet.</Text>
              <Button title="Log your first workout" onPress={() => router.push("/log-workout")} variant="secondary" style={{ marginTop: Spacing.sm }} />
            </Card>
          ) : (
            data.sessions.map((s) => (
              <Card key={s.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTitle}>{s.title}</Text>
                  <Text style={styles.sessionDate}>{formatDate(s.date)}</Text>
                </View>
                <Text style={styles.sessionMeta}>
                  {s.exercises.length} exercise{s.exercises.length === 1 ? "" : "s"}
                  {s.durationMins ? ` · ${s.durationMins} min` : ""}
                </Text>
                {s.exercises.map((ex, i) => (
                  <Text key={i} style={styles.sessionExercises} numberOfLines={1}>
                    {ex.name}
                    {formatExerciseLoad(ex) ? ` — ${formatExerciseLoad(ex)}` : ""}
                  </Text>
                ))}
                {s.runs.map((run, i) => (
                  <Text key={i} style={styles.sessionExercises} numberOfLines={1}>
                    Run — {formatRun(run)}
                  </Text>
                ))}
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.lg },
  heading: { fontSize: 24, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  logButton: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: Color.gold, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  logButtonText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
    marginBottom: Spacing.sm,
  },
  pbCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  pbTitle: { fontSize: 13, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.xs },
  pbRow: { flexDirection: "row", gap: Spacing.lg },
  pbStat: {},
  pbValue: { fontSize: 18, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  pbLabel: { fontSize: 10, color: Color.textMuted, marginTop: 1 },
  toolsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xl },
  toolCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  toolCardText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  trendPicker: { marginBottom: Spacing.sm },
  trendChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6, marginRight: Spacing.xs },
  trendChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  trendChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  trendChipTextActive: { color: Color.gold },
  trendCard: { padding: Spacing.md, alignItems: "center" },
  sessionCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sessionTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  sessionDate: { fontSize: 11, color: Color.textMuted },
  sessionMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  sessionExercises: { fontSize: 11, color: Color.textFaint, marginTop: 4 },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 12, color: Color.textMuted },
});
