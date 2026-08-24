import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useDeleteWorkoutSession, useWorkouts } from "@/lib/queries/workouts";
import { computeExerciseSetTotals, computeSessionTotals, formatExerciseSetLabels, formatRun } from "@/lib/workout-formatters";

function formatLongDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useWorkouts();
  const deleteSession = useDeleteWorkoutSession();

  const session = useMemo(() => data?.sessions.find((s) => s.id === id), [data, id]);
  const totals = useMemo(() => (session ? computeSessionTotals(session.exercises) : null), [session]);

  function handleDelete() {
    if (!session) return;
    Alert.alert("Delete this workout?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          tapFeedback();
          await deleteSession.mutateAsync(session.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Session Detail</Text>
        {session ? (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() =>
                router.push(
                  session.classId
                    ? { pathname: "/edit-class-workout", params: { id: session.id } }
                    : { pathname: "/edit-workout", params: { id: session.id } }
                )
              }
              hitSlop={12}
            >
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Ionicons name="trash-outline" size={18} color={Color.danger} />
            </Pressable>
          </View>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : !session || !totals ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>Couldn&apos;t find that session.</Text>
          <Button title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{session.title}</Text>
          <Text style={styles.date}>{formatLongDate(session.date)}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard label="DURATION" value={session.durationMins ? `${session.durationMins} min` : "—"} />
              <StatCard label="VOLUME" value={totals.totalVolume > 0 ? `${totals.totalVolume.toLocaleString()} kg` : "—"} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="SETS" value={String(totals.totalSets)} />
              <StatCard label="EXERCISES" value={String(session.exercises.length)} />
            </View>
          </View>

          {session.exercises.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>EXERCISES</Text>
              <Card style={styles.list}>
                {session.exercises.map((ex, idx) => {
                  const exTotals = computeExerciseSetTotals(ex);
                  const setLabels = formatExerciseSetLabels(ex);
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => router.push({ pathname: "/exercise-detail", params: { name: ex.name } })}
                      style={[styles.row, idx > 0 && styles.rowDivider]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.exerciseTitleRow}>
                          {ex.supersetGroup ? (
                            <View style={styles.supersetBadge}>
                              <Text style={styles.supersetBadgeText}>{ex.supersetGroup}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.rowTitle}>{ex.name}</Text>
                        </View>
                        {setLabels.length > 0 ? (
                          <View style={styles.setChipRow}>
                            {setLabels.map((label, i) => (
                              <View key={i} style={styles.setChip}>
                                <Text style={styles.setChipText}>{label}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.rowSummary}>—</Text>
                        )}
                      </View>
                      <View style={styles.rowMeta}>
                        <Text style={styles.rowMetaText}>{exTotals.sets} sets</Text>
                        <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            </>
          ) : null}

          {session.runs.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>RUNS</Text>
              <Card style={styles.list}>
                {session.runs.map((run, idx) => (
                  <View key={idx} style={[styles.row, idx > 0 && styles.rowDivider]}>
                    <Text style={styles.rowTitle}>{formatRun(run) || "Run"}</Text>
                    {run.notes ? <Text style={styles.rowSummary}>{run.notes}</Text> : null}
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {session.notes ? (
            <>
              <Text style={styles.sectionLabel}>NOTES</Text>
              <Card style={styles.notesCard}>
                <Text style={styles.notesText}>{session.notes}</Text>
              </Card>
            </>
          ) : null}
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  editLink: { fontSize: 14, fontWeight: "600", color: Color.gold },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { fontSize: 14, color: Color.textMuted },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: 22, fontWeight: "700", color: Color.textPrimary },
  date: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
  statsGrid: { gap: Spacing.sm, marginTop: Spacing.lg },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  list: { padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  rowTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  exerciseTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  supersetBadge: { borderRadius: 999, backgroundColor: Color.gold + "26", paddingHorizontal: 6, paddingVertical: 1 },
  supersetBadgeText: { fontSize: 10, fontWeight: "700", color: Color.gold },
  rowSummary: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  setChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  setChip: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  setChipText: { fontSize: 11, fontWeight: "500", color: Color.textSecondary, fontVariant: ["tabular-nums"] },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowMetaText: { fontSize: 11, color: Color.textFaint },
  notesCard: { padding: Spacing.md },
  notesText: { fontSize: 13, color: Color.textSecondary, lineHeight: 19 },
});
