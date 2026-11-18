import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { MemberSafetySheet } from "@/components/ui/MemberSafetySheet";
import { LikeButton } from "@/components/app/LikeButton";
import { Card } from "@/components/ui/Card";
import { CommentSheet } from "@/components/ui/CommentSheet";
import { MuscleThumb } from "@/components/ui/MuscleThumb";
import { Spacing } from "@/constants/theme";
import { CARDIO_LABEL } from "@/lib/cardio";
import { shareableNote, toTemplateExercises, workoutKind } from "@/lib/community-workout";
import { formatCommunityDate, formatPbExerciseName, formatWorkoutTitle } from "@/lib/community-formatters";
import { useAuth } from "@/lib/auth-context";
import { mergeSavedEntries } from "@/lib/entry-order";
import { muscleFocusFor } from "@/lib/exercise-muscles";
import { tapFeedback } from "@/lib/haptics";
import { useCommunityWorkoutItem, useToggleWorkoutLike } from "@/lib/queries/community";
import { supersetBadges } from "@/lib/superset-display";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { computeExerciseSetTotals, formatExerciseSetLabels, formatRun, groupSetLabels } from "@/lib/workout-formatters";
import { setPendingWorkoutTemplateSeed } from "@/lib/workout-template-seed";

// One workout from Community, in full: every exercise with its sets, the supersets and the type of workout (standard, AMRAP, EMOM, circuit, Tabata, chipper), and
// a way to save it as a template of your own. Two ways in: a Community card ("+N more exercises", comments closed), and a notification (a like, a comment, a
// mention), which opens straight to the workout with comments already open. Another member's personal exercise notes are never shown (lib/community-workout.ts).
export default function CommunityWorkoutScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { id, comments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const { data: item, isLoading, isError } = useCommunityWorkoutItem(id ?? "");
  const toggleLike = useToggleWorkoutLike();
  const [commentsOpen, setCommentsOpen] = useState(comments !== "0");
  const { user } = useAuth();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const pbExerciseName = item?.isPersonalBest ? formatPbExerciseName(item.personalBestExercise) : null;
  const kind = useMemo(() => workoutKind(item?.exercises ?? []), [item]);
  const merged = useMemo(() => mergeSavedEntries(item?.exercises ?? [], item?.runs ?? []), [item]);
  const badges = useMemo(() => supersetBadges(merged.map((m) => m.entry.supersetGroup ?? null)), [merged]);

  function handleSaveAsTemplate() {
    if (!item) return;
    tapFeedback();
    // The template builder opens already filled in; nothing is saved until the member taps Save there.
    setPendingWorkoutTemplateSeed({ name: formatWorkoutTitle(item.title), exercises: toTemplateExercises(item.exercises) });
    router.push("/workout-template-builder");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout</Text>
        {item && item.userId !== user?.id ? (
          <Pressable
            onPress={() => setSafetyOpen(true)}
            hitSlop={12}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${item.authorName}`}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={Color.textMuted} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !item ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>Couldn&apos;t find that workout.</Text>
          <Button title="Back to Community" variant="secondary" onPress={() => router.replace("/community")} style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.authorName} numberOfLines={1}>
                {item.authorName}
              </Text>
              <Text style={styles.date}>{formatCommunityDate(item.date, "long")}</Text>
            </View>
            <Text style={styles.title}>{formatWorkoutTitle(item.title)}</Text>
            <View style={styles.chipRow}>
              <View style={styles.kindChip}>
                <Text style={styles.kindChipText}>{kind.detail ? `${kind.label} · ${kind.detail}` : kind.label}</Text>
              </View>
              {item.isPersonalBest ? (
                <View style={styles.pbBadge}>
                  <Ionicons name="trophy" size={12} color={Color.brand} />
                  <Text style={styles.pbBadgeText}>{pbExerciseName ? `New ${pbExerciseName} PB` : "New PB"}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.stats}>
              {item.exercises.length} exercise{item.exercises.length === 1 ? "" : "s"}
              {item.runs.length > 0 ? ` · ${item.runs.length} cardio` : ""}
            </Text>

            <View style={styles.actions}>
              <LikeButton liked={item.likedByMe} count={item.likeCount} disabled={toggleLike.isPending} onToggle={() => toggleLike.mutate(item.id)} />
              <Pressable
                onPress={() => {
                  tapFeedback();
                  setCommentsOpen(true);
                }}
                style={styles.actionButton}
                hitSlop={8}
                accessibilityLabel="View comments"
              >
                <Ionicons name="chatbubble-outline" size={19} color={Color.textMuted} />
                {item.commentCount > 0 ? <Text style={styles.actionText}>{item.commentCount}</Text> : null}
              </Pressable>
              {toggleLike.isError ? <Text style={styles.actionError}>Couldn&apos;t update — try again</Text> : null}
            </View>
          </Card>

          {item.exercises.length > 0 ? (
            <>
              <Button title="Save to my templates" variant="secondary" onPress={handleSaveAsTemplate} style={{ marginTop: Spacing.md }} />
              <Text style={styles.hint}>Weights are left blank so you can set your own. You can change anything before you save.</Text>
            </>
          ) : null}

          <View style={styles.exerciseList}>
            {merged.map((entry, idx) => {
              const badge = badges[idx];
              if (entry.kind === "run") {
                const run = entry.entry;
                return (
                  <View key={`run-${idx}`} style={styles.exerciseCard}>
                    <View style={styles.exerciseHead}>
                      <View style={styles.exerciseIcon}>
                        <Ionicons name="walk-outline" size={18} color={Color.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName}>{CARDIO_LABEL[run.cardioType ?? "run"]}</Text>
                        <View style={styles.metaRow}>
                          {badge ? (
                            <View style={[styles.supersetBadge, { backgroundColor: badge.color }]}>
                              <Text style={styles.supersetBadgeText}>{badge.label}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.exerciseMeta}>{formatRun(run) || "Cardio"}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }
              const ex = entry.entry;
              const totals = computeExerciseSetTotals(ex);
              const groups = groupSetLabels(formatExerciseSetLabels(ex));
              const focus = muscleFocusFor(ex.name, undefined, ex.muscleSection);
              const note = shareableNote(ex.notes);
              return (
                <View key={`ex-${idx}`} style={styles.exerciseCard}>
                  <View style={styles.exerciseHead}>
                    <View style={styles.exerciseIcon}>
                      {focus ? <MuscleThumb focus={focus} size={44} /> : <Ionicons name="barbell-outline" size={18} color={Color.textMuted} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{ex.name.trim() || "Exercise"}</Text>
                      <View style={styles.metaRow}>
                        {badge ? (
                          <View style={[styles.supersetBadge, { backgroundColor: badge.color }]}>
                            <Text style={styles.supersetBadgeText}>{badge.label}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.exerciseMeta}>
                          {totals.sets} set{totals.sets === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {groups.length > 0 ? (
                    <View style={styles.setTable}>
                      {groups.map((g, i) => (
                        <View key={i} style={[styles.setRow, i > 0 && styles.setRowDivider]}>
                          <Text style={styles.setNumber}>{g.from === g.to ? `Set ${g.from}` : `Sets ${g.from}–${g.to}`}</Text>
                          <Text style={styles.setValue}>{g.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {note ? <Text style={styles.formatNote}>{note}</Text> : null}
                </View>
              );
            })}
          </View>

          <Button title="View Community" variant="secondary" onPress={() => router.push("/community")} style={{ marginTop: Spacing.md }} />
        </ScrollView>
      )}

      {item ? <CommentSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} workoutSessionId={item.id} /> : null}
      {safetyOpen && item ? (
        <MemberSafetySheet visible onClose={() => setSafetyOpen(false)} memberUserId={item.userId} memberName={item.authorName} workoutId={item.id} />
      ) : null}
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
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    emptyText: { color: Color.textMuted, fontSize: 14 },
    body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    card: { padding: Spacing.md },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    authorName: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, flexShrink: 1 },
    date: { fontSize: 13, color: Color.textMuted },
    title: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginTop: 4 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
    kindChip: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: 999, backgroundColor: Color.surface2 },
    kindChipText: { fontSize: 12, fontWeight: "700", color: Color.textPrimary },
    pbBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: Color.surface2,
    },
    pbBadgeText: { fontSize: 12, fontWeight: "700", color: Color.textPrimary },
    stats: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm },
    hint: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.xs, textAlign: "center" },
    exerciseList: { marginTop: Spacing.md, gap: Spacing.sm },
    exerciseCard: { backgroundColor: Color.surface1, borderRadius: 16, padding: Spacing.md },
    exerciseHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    exerciseIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Color.bg0, alignItems: "center", justifyContent: "center" },
    exerciseName: { fontSize: 16, fontWeight: "600", color: Color.textPrimary },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    exerciseMeta: { fontSize: 13, color: Color.textMuted },
    supersetBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    supersetBadgeText: { fontSize: 11, fontWeight: "800", color: "#0a1526" },
    setTable: { marginTop: Spacing.sm },
    setRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
    setRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle },
    setNumber: { fontSize: 13, color: Color.textMuted },
    setValue: { fontSize: 14, fontWeight: "500", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
    formatNote: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.sm },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.lg,
      marginTop: Spacing.md,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color.borderSubtle,
    },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
    actionText: { fontSize: 15, fontWeight: "500", color: Color.textMuted },
    actionError: { fontSize: 13, color: Color.danger, marginLeft: "auto" },
  })
);
