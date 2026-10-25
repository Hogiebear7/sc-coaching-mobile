import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MUSCLE_GROUP_LABEL, MuscleMap } from "@/components/ui/MuscleMap";
import { StatCard } from "@/components/ui/StatCard";
import { headline, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import type { PrescribedExercise } from "@/lib/queries/programs";
import { useDeleteWorkoutSession, useSetWorkoutVisibility, useWorkouts, type WorkoutExerciseEntry } from "@/lib/queries/workouts";
import { setPendingWorkoutTemplateSeed } from "@/lib/workout-template-seed";
import { computeExerciseSetTotals, computeSessionTotals, formatExerciseSetLabels, formatRun, groupSetLabels } from "@/lib/workout-formatters";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

function formatLongDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

let templateKeySeq = 0;
function nextTemplateKey(): string {
  templateKeySeq += 1;
  return `${Date.now()}-${templateKeySeq}`;
}

// Same target-shape conversion as log-workout.tsx's own "Save as template"
// (handleSaveAsTemplate) — this is the same action, just reachable from a
// past session instead of only while actively logging one.
function toPrescribedExercise(ex: WorkoutExerciseEntry): PrescribedExercise {
  return {
    id: nextTemplateKey(),
    exerciseId: ex.exerciseId,
    name: ex.name,
    muscleTags: [],
    targetSets: ex.sets,
    targetReps: ex.perSide && ex.reps !== null ? `R${ex.reps} / L${ex.reps}` : ex.reps !== null ? String(ex.reps) : null,
    targetWeight: ex.weight,
    setType: ex.setType ?? null,
    sets: null,
    supersetGroup: ex.supersetGroup ?? null,
    notes: ex.notes,
  };
}

export default function SessionDetailScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useWorkouts();
  const deleteSession = useDeleteWorkoutSession();
  const setVisibility = useSetWorkoutVisibility();

  const session = useMemo(() => data?.sessions.find((s) => s.id === id), [data, id]);
  const totals = useMemo(() => (session ? computeSessionTotals(session.exercises) : null), [session]);
  const sectionByExerciseId = useMemo(
    () => new Map((data?.exerciseLibrary ?? []).map((e) => [e.id, e.section])),
    [data]
  );

  function handleSaveAsTemplate() {
    if (!session) return;
    tapFeedback();
    setPendingWorkoutTemplateSeed({
      name: session.title,
      exercises: session.exercises.map(toPrescribedExercise),
    });
    router.push("/workout-template-builder");
  }

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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout</Text>
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
              style={styles.headerIconButton}
              accessibilityRole="button"
              accessibilityLabel="Edit workout"
            >
              <Ionicons name="create-outline" size={20} color={Color.textPrimary} />
            </Pressable>
            <Pressable
              onPress={handleSaveAsTemplate}
              style={styles.headerIconButton}
              accessibilityRole="button"
              accessibilityLabel="Save as template"
              disabled={session.exercises.length === 0}
            >
              <Ionicons
                name="bookmark-outline"
                size={19}
                color={session.exercises.length === 0 ? Color.textFaint : Color.textPrimary}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                tapFeedback();
                setVisibility.mutate({ sessionId: session.id, isPrivate: !session.isPrivate });
              }}
              style={styles.headerIconButton}
              accessibilityRole="button"
              accessibilityLabel={session.isPrivate ? "Show in Community feed" : "Hide from Community feed"}
            >
              <Ionicons
                name={session.isPrivate ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={Color.textPrimary}
              />
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel="Delete workout">
              <Ionicons name="trash-outline" size={19} color={Color.danger} />
            </Pressable>
          </View>
        ) : (
          <View style={{ width: 36 }} />
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
          {session.isPrivate ? (
            <View style={styles.privateBadge}>
              <Ionicons name="eye-off-outline" size={12} color={Color.textFaint} />
              <Text style={styles.privateBadgeText}>Hidden from Community feed</Text>
            </View>
          ) : null}

          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard label="Duration" value={session.durationMins ? `${session.durationMins} min` : "—"} />
              <StatCard label="Volume" value={totals.totalVolume > 0 ? `${totals.totalVolume.toLocaleString()} kg` : "—"} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Sets" value={String(totals.totalSets)} />
              <StatCard label="Exercises" value={String(session.exercises.length)} />
            </View>
          </View>

          {session.exercises.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Exercises</Text>
              <View style={styles.exerciseList}>
                {session.exercises.map((ex, idx) => {
                  const exTotals = computeExerciseSetTotals(ex);
                  const groups = groupSetLabels(formatExerciseSetLabels(ex));
                  const section = ex.exerciseId ? sectionByExerciseId.get(ex.exerciseId) : undefined;
                  const meta = [
                    section ? MUSCLE_GROUP_LABEL[section].primary : null,
                    `${exTotals.sets} set${exTotals.sets === 1 ? "" : "s"}`,
                    exTotals.volume > 0 ? `${Math.round(exTotals.volume).toLocaleString()} kg` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        tapFeedback();
                        router.push({ pathname: "/exercise-detail", params: { name: ex.name } });
                      }}
                      style={({ pressed }) => [styles.exerciseCard, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${ex.name}, ${meta}`}
                    >
                      <View style={styles.exerciseHead}>
                        <View style={styles.exerciseIcon}>
                          {section ? (
                            <MuscleMap section={section} size={34} />
                          ) : (
                            <Text style={styles.exerciseIndex}>{idx + 1}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.exerciseName}>{ex.name}</Text>
                          <View style={styles.exerciseMetaRow}>
                            {ex.supersetGroup ? (
                              <View style={styles.supersetBadge}>
                                <Text style={styles.supersetBadgeText}>Superset {ex.supersetGroup.replace(/^ST/, "")}</Text>
                              </View>
                            ) : null}
                            <Text style={styles.exerciseMeta}>{meta}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
                      </View>
                      {groups.length > 0 ? (
                        <View style={styles.setTable}>
                          {groups.map((g, i) => (
                            <View key={i} style={[styles.setRow, i > 0 && styles.setRowDivider]}>
                              <Text style={styles.setNumber}>
                                {g.from === g.to ? `Set ${g.from}` : `Sets ${g.from}–${g.to}`}
                              </Text>
                              <Text style={styles.setValue}>{g.label}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {ex.notes ? <Text style={styles.exerciseNote}>{ex.notes}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {session.runs.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Runs</Text>
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
              <Text style={styles.sectionLabel}>Notes</Text>
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

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    emptyText: { fontSize: 14, color: Color.textMuted },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    title: { ...headline(28), color: Color.textPrimary },
    date: { fontSize: 15, color: Color.textMuted, marginTop: 2 },
    privateBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    privateBadgeText: { fontSize: 13, color: Color.textFaint },
    statsGrid: { gap: Spacing.sm, marginTop: Spacing.lg },
    statsRow: { flexDirection: "row", gap: Spacing.sm },
    sectionLabel: { fontSize: 19, fontWeight: "600", color: Color.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
    list: { padding: 0, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
    rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    rowTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    rowSummary: { fontSize: 14, color: Color.textMuted, marginTop: 2 },
    exerciseList: { gap: Spacing.sm },
    exerciseCard: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.md },
    exerciseHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    exerciseIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Color.bg0, alignItems: "center", justifyContent: "center" },
    exerciseIndex: { fontSize: 16, fontWeight: "600", color: Color.textSecondary, fontVariant: ["tabular-nums"] },
    exerciseName: { fontSize: 17, fontWeight: "600", color: Color.textPrimary },
    exerciseMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 3 },
    exerciseMeta: { fontSize: 14, color: Color.textMuted },
    supersetBadge: { borderRadius: Radius.pill, backgroundColor: Color.surface2, paddingHorizontal: 8, paddingVertical: 2 },
    supersetBadgeText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
    setTable: { marginTop: 12, borderRadius: Radius.md, backgroundColor: Color.bg0, paddingHorizontal: 14 },
    setRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 42, gap: Spacing.md },
    setRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle },
    setNumber: { fontSize: 14, color: Color.textMuted, fontVariant: ["tabular-nums"] },
    setValue: { flexShrink: 1, fontSize: 16, fontWeight: "600", color: Color.textPrimary, fontVariant: ["tabular-nums"], textAlign: "right" },
    exerciseNote: { fontSize: 14, lineHeight: 20, color: Color.textMuted, marginTop: 10, fontStyle: "italic" },
    notesCard: { padding: Spacing.md },
    notesText: { fontSize: 13, color: Color.textSecondary, lineHeight: 19 },
  })
);
