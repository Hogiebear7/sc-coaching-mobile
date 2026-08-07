import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateStrip } from "@/components/ui/DateStrip";
import { SessionCard } from "@/components/ui/SessionCard";
import { TrendChart } from "@/components/ui/TrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useAdvanceProgram, useMyProgram } from "@/lib/queries/programs";
import { useWorkouts } from "@/lib/queries/workouts";
import { getExerciseTrend, todayDateString } from "@/lib/workout-formatters";

// Oldest-first window of dates ending today, for the date strip. UTC-based
// arithmetic to match todayDateString()'s convention (used app-wide for the
// log-workout date default) — anchoring both on the same "today" avoids the
// strip and the log form disagreeing near a timezone boundary.
function recentDates(days: number, anchor: string): string[] {
  const out: string[] = [];
  const [y, m, d] = anchor.split("-").map(Number);
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return out;
}

function formatLongDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useWorkouts();
  const { data: program } = useMyProgram();
  const advanceProgram = useAdvanceProgram();
  const [trendExercise, setTrendExercise] = useState<string | null>(null);

  const today = todayDateString();
  const dateWindow = useMemo(() => recentDates(21, today), [today]);
  const [selectedDate, setSelectedDate] = useState(today);

  const markedDates = useMemo(() => new Set((data?.sessions ?? []).map((s) => s.date)), [data]);
  const sessionsForSelectedDate = useMemo(
    () => (data?.sessions ?? []).filter((s) => s.date === selectedDate),
    [data, selectedDate]
  );

  const currentDay = program?.days[program.currentDayIndex] ?? null;

  function handleMarkDayComplete() {
    if (!program) return;
    tapFeedback();
    advanceProgram.mutate(program.id);
  }

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

        <View style={styles.section}>
          <DateStrip dates={dateWindow} selectedDate={selectedDate} today={today} markedDates={markedDates} onSelect={setSelectedDate} />
          <Card style={styles.dayDetailCard}>
            <Text style={styles.dayDetailDate}>{selectedDate === today ? "Today" : formatLongDate(selectedDate)}</Text>
            {sessionsForSelectedDate.length > 0 ? (
              sessionsForSelectedDate.map((s) => <SessionCard key={s.id} session={s} showDate={false} />)
            ) : (
              <View style={styles.dayDetailEmpty}>
                <Text style={styles.dayDetailEmptyText}>Nothing logged this day.</Text>
                <Button
                  title="Log a workout"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/log-workout", params: { date: selectedDate } })}
                  style={{ marginTop: Spacing.sm }}
                />
              </View>
            )}
          </Card>
        </View>

        {program && currentDay ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIVE PROGRAM</Text>
            <Card style={styles.programCard}>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programDayLabel}>{currentDay.label}</Text>

              {currentDay.type === "rest" ? (
                <>
                  <View style={styles.restRow}>
                    <Ionicons name="moon-outline" size={18} color={Color.textMuted} />
                    <Text style={styles.restText}>Rest day — no exercises prescribed.</Text>
                  </View>
                  <Button
                    title="Mark complete"
                    variant="secondary"
                    onPress={handleMarkDayComplete}
                    loading={advanceProgram.isPending}
                    style={{ marginTop: Spacing.md }}
                  />
                </>
              ) : (
                <>
                  {currentDay.exercises.map((ex) => (
                    <View key={ex.id} style={styles.programExerciseRow}>
                      <Text style={styles.programExerciseName}>{ex.name}</Text>
                      <Text style={styles.programExerciseTarget}>
                        {[
                          ex.targetSets !== null && ex.targetReps ? `${ex.targetSets} × ${ex.targetReps}` : ex.targetReps ?? (ex.targetSets !== null ? `${ex.targetSets} sets` : null),
                          ex.targetWeight,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                      {ex.muscleTags.length > 0 ? (
                        <View style={styles.muscleTagRow}>
                          {ex.muscleTags.map((tag) => (
                            <View key={tag} style={styles.muscleTagChip}>
                              <Text style={styles.muscleTagChipText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                  <Button
                    title="Start workout"
                    onPress={() =>
                      router.push({
                        pathname: "/log-workout",
                        params: { programId: program.id, dayId: currentDay.id, title: currentDay.label },
                      })
                    }
                    style={{ marginTop: Spacing.md }}
                  />
                  <Pressable onPress={handleMarkDayComplete} style={styles.skipRow}>
                    <Text style={styles.skipText}>Skip to next day</Text>
                  </Pressable>
                </>
              )}
            </Card>
          </View>
        ) : null}

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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
            {data.sessions.length > 0 ? (
              <Pressable onPress={() => router.push("/workout-history")}>
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            ) : null}
          </View>
          {data.sessions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={22} color={Color.textFaint} />
              <Text style={styles.emptyText}>No workouts logged yet.</Text>
              <Button title="Log your first workout" onPress={() => router.push("/log-workout")} variant="secondary" style={{ marginTop: Spacing.sm }} />
            </Card>
          ) : (
            data.sessions.slice(0, 5).map((s) => <SessionCard key={s.id} session={s} />)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MORE</Text>
          <Card>
            <Pressable onPress={() => router.push("/workout-library")} style={styles.moreRow}>
              <View style={styles.moreRowIcon}>
                <Ionicons name="albums-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moreRowTitle}>Workout Library</Text>
                <Text style={styles.moreRowSub}>Your saved, reusable workouts</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
            <Pressable onPress={() => router.push("/workout-history")} style={[styles.moreRow, styles.moreRowDivider]}>
              <View style={styles.moreRowIcon}>
                <Ionicons name="time-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moreRowTitle}>Workout History</Text>
                <Text style={styles.moreRowSub}>Every session you&apos;ve logged</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
            <Pressable onPress={() => router.push("/workout-archive")} style={[styles.moreRow, styles.moreRowDivider]}>
              <View style={styles.moreRowIcon}>
                <Ionicons name="archive-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moreRowTitle}>Archive</Text>
                <Text style={styles.moreRowSub}>Past programs and retired templates</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
          </Card>
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
  programCard: { padding: Spacing.md },
  programName: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  programDayLabel: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, marginTop: 2, marginBottom: Spacing.sm },
  restRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingVertical: Spacing.sm },
  restText: { fontSize: 13, color: Color.textMuted },
  programExerciseRow: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  programExerciseName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  programExerciseTarget: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  muscleTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: Spacing.xs },
  muscleTagChip: { borderRadius: Radius.pill, backgroundColor: Color.goldWeak, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  muscleTagChipText: { fontSize: 10, fontWeight: "600", color: Color.gold },
  skipRow: { alignItems: "center", marginTop: Spacing.sm, paddingVertical: 6 },
  skipText: { fontSize: 12, color: Color.textFaint },
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
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 12, color: Color.textMuted },
  dayDetailCard: { padding: Spacing.md, marginTop: Spacing.sm },
  dayDetailDate: { fontSize: 13, fontWeight: "600", color: Color.textSecondary, marginBottom: Spacing.sm },
  dayDetailEmpty: { alignItems: "center", paddingVertical: Spacing.md },
  dayDetailEmptyText: { fontSize: 12, color: Color.textMuted },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seeAllText: { fontSize: 12, fontWeight: "600", color: Color.gold, marginBottom: Spacing.sm },
  moreRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md },
  moreRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  moreRowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  moreRowTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  moreRowSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
});
