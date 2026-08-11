import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Color, Radius, Spacing } from "@/constants/theme";

// Built entirely from the payload the logging screen just submitted, plus
// the personalBests it already had in memory — no server round-trip, no
// new API. See log-workout.tsx's handleSubmit for how this is computed.
export interface WorkoutSummaryData {
  title: string;
  date: string;
  durationLabel: string;
  totalVolume: number;
  totalSets: number;
  completedSets: number;
  totalExercises: number;
  completedExercises: number;
  exercises: { name: string; summary: string; setsLogged: number; setsCompleted: number; isPb: boolean }[];
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const { data: dataParam } = useLocalSearchParams<{ data?: string }>();

  const summary = useMemo<WorkoutSummaryData | null>(() => {
    if (!dataParam) return null;
    try {
      return JSON.parse(dataParam) as WorkoutSummaryData;
    } catch {
      return null;
    }
  }, [dataParam]);

  if (!summary) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Workout logged.</Text>
          <Button title="Done" onPress={() => router.replace("/workouts")} style={{ marginTop: Spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const pbCount = summary.exercises.filter((ex) => ex.isPb).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroWrap}>
          <View style={styles.heroBadge}>
            <Ionicons name="checkmark" size={32} color={Color.bg0} />
          </View>
          <Text style={styles.heroTitle}>Workout Complete</Text>
          <Text style={styles.heroSubtitle}>
            {summary.title || "Workout"} · {summary.date}
          </Text>
          {pbCount > 0 ? (
            <View style={styles.pbPill}>
              <Ionicons name="trophy" size={12} color={Color.gold} />
              <Text style={styles.pbPillText}>
                {pbCount} new personal {pbCount === 1 ? "best" : "bests"}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard label="DURATION" value={summary.durationLabel} />
            <StatCard label="VOLUME" value={summary.totalVolume > 0 ? `${summary.totalVolume.toLocaleString()} kg` : "—"} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="SETS" value={`${summary.completedSets}/${summary.totalSets}`} />
            <StatCard label="EXERCISES" value={`${summary.completedExercises}/${summary.totalExercises}`} />
          </View>
        </View>

        {summary.exercises.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>EXERCISES</Text>
            <Card style={styles.exerciseList}>
              {summary.exercises.map((ex, idx) => (
                <View key={`${ex.name}-${idx}`} style={[styles.exerciseRow, idx > 0 && styles.exerciseRowDivider]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.exerciseNameRow}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      {ex.isPb ? (
                        <View style={styles.pbBadge}>
                          <Text style={styles.pbBadgeText}>PB</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.exerciseSummary}>{ex.summary || "—"}</Text>
                  </View>
                  <Text style={styles.exerciseSets}>
                    {ex.setsCompleted}/{ex.setsLogged} sets
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Button title="Done" onPress={() => router.replace("/workouts")} style={{ marginTop: Spacing.xl }} />
        <Button
          title="View full history"
          variant="secondary"
          onPress={() => router.push("/workout-history")}
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { fontSize: 15, color: Color.textSecondary },
  heroWrap: { alignItems: "center", paddingVertical: Spacing.xl },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Color.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroTitle: { fontSize: 22, fontWeight: "700", color: Color.textPrimary },
  heroSubtitle: { fontSize: 13, color: Color.textMuted, marginTop: 4 },
  pbPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginTop: Spacing.md,
  },
  pbPillText: { fontSize: 12, fontWeight: "700", color: Color.gold },
  statsGrid: { gap: Spacing.sm, marginTop: Spacing.md },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  exerciseList: { padding: 0, overflow: "hidden" },
  exerciseRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
  exerciseRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  exerciseNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  exerciseName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  exerciseSummary: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  exerciseSets: { fontSize: 11, color: Color.textFaint, marginTop: 2 },
  pbBadge: { borderRadius: Radius.sm, backgroundColor: Color.goldWeak, paddingHorizontal: 6, paddingVertical: 1 },
  pbBadgeText: { fontSize: 9, fontWeight: "700", color: Color.gold },
});
