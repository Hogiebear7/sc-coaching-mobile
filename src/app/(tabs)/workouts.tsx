import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateStrip } from "@/components/ui/DateStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SessionCard } from "@/components/ui/SessionCard";
import { TrendChart } from "@/components/ui/TrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useAdvanceProgram, useMyProgram } from "@/lib/queries/programs";
import { useRestTimer } from "@/lib/rest-timer";
import { type PersonalBest, useWorkouts } from "@/lib/queries/workouts";
import {
  TREND_RANGES,
  computeWeeklyStats,
  filterPointsByRange,
  getExerciseMetricTrend,
  getRecentRecords,
  todayDateString,
  type ExerciseMetricKey,
} from "@/lib/workout-formatters";

// A deliberately narrow slice of the full EXERCISE_METRICS list (which also
// has Est. 1RM/Volume/Best Set Vol./Sets) — this compact widget covers just
// the three axes a member actually thinks in day-to-day ("how heavy, how
// many, how long"), matching how log-workout's own weight/time/band toggle
// frames a set. The full switcher is one tap away via "View history."
const COMPACT_TREND_METRICS: { key: ExerciseMetricKey; label: string }[] = [
  { key: "heaviestWeight", label: "Weight" },
  { key: "totalReps", label: "Reps" },
  { key: "bestTimeSecs", label: "Time" },
];

// getExerciseMetricTrend never returns a null point, but an "additive"
// metric like totalReps defaults to 0 (not null) for a session where that
// axis genuinely wasn't tracked — a pure-hold exercise like Plank Hold logs
// real seconds and no reps at all, so its reps series is two same-day
// zeroes, which technically satisfies "length >= 2" without meaning
// anything. Requiring at least one real (>0) value is what actually
// distinguishes "tracked but small" from "never tracked."
function hasMetricTrend(sessions: Parameters<typeof getExerciseMetricTrend>[0], name: string, key: ExerciseMetricKey): boolean {
  const points = getExerciseMetricTrend(sessions, name, key);
  return points.length >= 2 && points.some((p) => p.value > 0);
}

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

function formatShortDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const restTimer = useRestTimer();
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

  // Exercises with at least 2 dated points on ANY of the three compact
  // metrics — the only ones a trend chart can say anything about. A
  // hold-only exercise (no weight ever logged) still qualifies via Time,
  // a bodyweight-only one via Reps. Most-recently-logged first.
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
      .filter((c) => COMPACT_TREND_METRICS.some((m) => hasMetricTrend(data.sessions, c.name, m.key)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const activeTrendExercise = trendExercise ?? trendCandidates[0]?.name ?? null;

  const [trendMetric, setTrendMetric] = useState<ExerciseMetricKey | null>(null);
  // Default to whichever of weight/reps/time actually has data for the
  // exercise currently selected — same "don't default to an empty chart"
  // rule exercise-detail.tsx already uses for its own metric switcher.
  const availableMetrics = useMemo(
    () =>
      data && activeTrendExercise
        ? COMPACT_TREND_METRICS.filter((m) => hasMetricTrend(data.sessions, activeTrendExercise, m.key))
        : [],
    [data, activeTrendExercise]
  );
  const activeTrendMetric: ExerciseMetricKey = trendMetric ?? availableMetrics[0]?.key ?? "heaviestWeight";

  const [trendRange, setTrendRange] = useState("All");
  const trendPoints = useMemo(
    () => (data && activeTrendExercise ? getExerciseMetricTrend(data.sessions, activeTrendExercise, activeTrendMetric) : []),
    [data, activeTrendExercise, activeTrendMetric]
  );
  const filteredTrendPoints = useMemo(() => filterPointsByRange(trendPoints, trendRange, today), [trendPoints, trendRange, today]);

  const weeklyStats = useMemo(() => (data ? computeWeeklyStats(data.sessions, today) : null), [data, today]);
  const allRecentRecords = useMemo(() => (data ? getRecentRecords(data.sessions, 30, today) : []), [data, today]);
  const recentRecords = useMemo(() => allRecentRecords.slice(0, 3), [allRecentRecords]);

  const pinnedBests = useMemo(() => {
    if (!data) return [];
    const byName = new Map(data.personalBests.map((pb) => [pb.exerciseName.toLowerCase(), pb]));
    return data.pinnedExercises
      .map((name) => byName.get(name.toLowerCase()))
      .filter((pb): pb is PersonalBest => pb != null);
  }, [data]);

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
          <Card style={styles.dayDetailCard} tier={selectedDate === today ? "hero" : "standard"}>
            <Text style={styles.dayDetailDate}>{selectedDate === today ? "Today" : formatLongDate(selectedDate)}</Text>
            {sessionsForSelectedDate.length > 0 ? (
              sessionsForSelectedDate.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  showDate={false}
                  onPress={() => router.push({ pathname: "/session-detail", params: { id: s.id } })}
                />
              ))
            ) : (
              <EmptyState
                icon="barbell-outline"
                title={selectedDate === today ? "Nothing logged today" : "Nothing logged this day"}
                body="Log a workout or repeat your last session."
                actionLabel="Log a workout"
                onAction={() => router.push({ pathname: "/log-workout", params: { date: selectedDate } })}
                variant="primary"
              />
            )}
          </Card>
        </View>

        {program && currentDay ? (
          <View style={styles.section}>
            <SectionHeader label="ACTIVE PROGRAM" />
            <Card style={styles.programCard} tier="hero">
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {ex.supersetGroup ? (
                          <View style={styles.supersetBadge}>
                            <Text style={styles.supersetBadgeText}>{ex.supersetGroup}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.programExerciseName}>{ex.name}</Text>
                      </View>
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

        <View style={styles.section}>
          <SectionHeader label="TOOLS" />
          <View style={styles.toolsRow}>
            <Card tier="compact" style={styles.toolCard}>
              <Pressable onPress={() => router.push("/plate-calculator")} style={styles.toolCardInner}>
                <Ionicons name="barbell-outline" size={18} color={Color.gold} />
                <Text style={styles.toolCardText}>Plate Calculator</Text>
              </Pressable>
            </Card>
            <Card tier="compact" style={styles.toolCard}>
              <Pressable
                onPress={() => {
                  if (!restTimer.isRunning) restTimer.reset(90);
                  router.push({ pathname: "/rest-timer" });
                }}
                style={styles.toolCardInner}
              >
                <Ionicons name="timer-outline" size={18} color={Color.gold} />
                <Text style={styles.toolCardText}>Rest Timer</Text>
              </Pressable>
            </Card>
            <Card tier="compact" style={styles.toolCard}>
              <Pressable onPress={() => router.push("/workout-generator")} style={styles.toolCardInner}>
                <Ionicons name="sparkles-outline" size={18} color={Color.gold} />
                <Text style={styles.toolCardText}>Generate</Text>
              </Pressable>
            </Card>
          </View>
        </View>

        {weeklyStats ? (
          <View style={styles.section}>
            <SectionHeader label="THIS WEEK" />
            <View style={styles.weekStatsRow}>
              <Card tier="compact" style={styles.weekStat}>
                <Text style={styles.weekStatValue}>{weeklyStats.workoutCount}</Text>
                <Text style={styles.weekStatLabel}>workouts</Text>
              </Card>
              <Card tier="compact" style={styles.weekStat}>
                <Text style={styles.weekStatValue}>{weeklyStats.totalSets}</Text>
                <Text style={styles.weekStatLabel}>sets</Text>
              </Card>
              <Card tier="compact" style={styles.weekStat}>
                <Text style={styles.weekStatValue}>{weeklyStats.totalVolume > 0 ? weeklyStats.totalVolume.toLocaleString() : "0"}</Text>
                <Text style={styles.weekStatLabel}>kg volume</Text>
              </Card>
            </View>
          </View>
        ) : null}

        {recentRecords.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              label="RECENT RECORDS"
              action={allRecentRecords.length > 3 ? { label: "See more", onPress: () => router.push({ pathname: "/workout-records" }) } : undefined}
            />
            <Card style={styles.recordsList}>
              {recentRecords.map((r, idx) => (
                <Pressable
                  key={`${r.exerciseName}-${r.type}-${r.date}`}
                  onPress={() => router.push({ pathname: "/exercise-detail", params: { name: r.exerciseName } })}
                  style={[styles.recordRow, idx > 0 && styles.recordRowDivider]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordExercise}>{r.exerciseName}</Text>
                    <Text style={styles.recordLabel}>{r.label}</Text>
                  </View>
                  <View style={styles.recordValueWrap}>
                    <Text style={styles.recordValue}>{r.value}</Text>
                    <Text style={styles.recordDate}>{formatShortDate(r.date)}</Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}

        {data.personalBests.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              label="PERSONAL BESTS"
              action={{ label: pinnedBests.length > 0 ? "Edit" : "Choose", onPress: () => router.push("/personal-bests-edit") }}
            />
            {pinnedBests.length > 0 ? (
              pinnedBests.map((pb) => (
                <Pressable
                  key={pb.exerciseName}
                  onPress={() => router.push({ pathname: "/exercise-detail", params: { name: pb.exerciseName } })}
                >
                  <Card style={styles.pbCard}>
                    <View style={styles.pbHeaderRow}>
                      <Text style={styles.pbTitle}>{pb.exerciseName}</Text>
                      <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
                    </View>
                    {pb.heaviestWeight ? (
                      <View style={styles.pbStat}>
                        <Text style={styles.pbValue}>{pb.heaviestWeight.weightStr}</Text>
                        <Text style={styles.pbLabel}>PB weight — tap for reps, sets &amp; history</Text>
                      </View>
                    ) : pb.highestReps ? (
                      <View style={styles.pbStat}>
                        <Text style={styles.pbValue}>{pb.highestReps.reps} reps</Text>
                        <Text style={styles.pbLabel}>best reps — tap for history</Text>
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              ))
            ) : (
              <Card tier="quiet">
                <EmptyState
                  icon="trophy-outline"
                  title="No personal bests yet"
                  body="Pick up to 5 lifts to feature here and track them at a glance."
                  actionLabel="Choose your personal bests"
                  onAction={() => router.push("/personal-bests-edit")}
                />
              </Card>
            )}
          </View>
        )}

        {data.sessions.length > 0 && trendCandidates.length === 0 ? (
          <View style={styles.section}>
            <SectionHeader label="PROGRESSION" />
            <Card tier="quiet">
              <EmptyState
                icon="trending-up-outline"
                title="Not enough data yet"
                body="Log the same exercise a couple more times to unlock your progression trend."
              />
            </Card>
          </View>
        ) : null}

        {trendCandidates.length > 0 && activeTrendExercise ? (
          <View style={styles.section}>
            <SectionHeader label="PROGRESSION" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendPicker} contentContainerStyle={{ gap: Spacing.xs }}>
              {trendCandidates.slice(0, 10).map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    setTrendExercise(c.name);
                    setTrendMetric(null);
                  }}
                  style={[styles.trendChip, activeTrendExercise === c.name && styles.trendChipActive]}
                >
                  <Text style={[styles.trendChipText, activeTrendExercise === c.name && styles.trendChipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {availableMetrics.length > 1 ? (
              <View style={styles.metricRow}>
                {availableMetrics.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setTrendMetric(m.key)}
                    style={[styles.metricChip, activeTrendMetric === m.key && styles.metricChipActive]}
                  >
                    <Text style={[styles.metricChipText, activeTrendMetric === m.key && styles.metricChipTextActive]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
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
            <Pressable
              onPress={() => router.push({ pathname: "/exercise-detail", params: { name: activeTrendExercise } })}
              style={styles.viewHistoryRow}
            >
              <Text style={styles.viewHistoryText}>View {activeTrendExercise} history</Text>
              <Ionicons name="chevron-forward" size={14} color={Color.gold} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            label="RECENT SESSIONS"
            action={data.sessions.length > 0 ? { label: "See all", onPress: () => router.push("/workout-history") } : undefined}
          />
          {data.sessions.length === 0 ? (
            <Card tier="quiet">
              <EmptyState
                icon="barbell-outline"
                title="No workouts logged yet"
                body="Log your first workout to start building your training history."
                actionLabel="Log your first workout"
                onAction={() => router.push("/log-workout")}
                variant="primary"
              />
            </Card>
          ) : (
            data.sessions
              .slice(0, 5)
              .map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onPress={() => router.push({ pathname: "/session-detail", params: { id: s.id } })}
                />
              ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader label="MORE" />
          <Card tier="quiet">
            <Pressable onPress={() => router.push("/workout-trends")} style={styles.moreRow}>
              <View style={styles.moreRowIcon}>
                <Ionicons name="trending-up-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moreRowTitle}>Training Trends</Text>
                <Text style={styles.moreRowSub}>Sets and volume over time</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
            <Pressable onPress={() => router.push("/workout-library")} style={[styles.moreRow, styles.moreRowDivider]}>
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
  weekStatsRow: { flexDirection: "row", gap: Spacing.sm },
  weekStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  weekStatValue: { fontSize: 20, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  weekStatLabel: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  recordsList: { padding: 0, overflow: "hidden" },
  recordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
  recordRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  recordExercise: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  recordLabel: { fontSize: 11, color: Color.textMuted, marginTop: 1 },
  recordValueWrap: { alignItems: "flex-end" },
  recordValue: { fontSize: 14, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  recordDate: { fontSize: 10, color: Color.textFaint, marginTop: 1 },
  pbCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  pbHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  pbTitle: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  pbStat: {},
  pbValue: { fontSize: 22, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  pbLabel: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  programCard: { padding: Spacing.md },
  programName: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  programDayLabel: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, marginTop: 2, marginBottom: Spacing.sm },
  restRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingVertical: Spacing.sm },
  restText: { fontSize: 13, color: Color.textMuted },
  programExerciseRow: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  programExerciseName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  programExerciseTarget: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  supersetBadge: { borderRadius: 999, backgroundColor: Color.gold + "26", paddingHorizontal: 6, paddingVertical: 1 },
  supersetBadgeText: { fontSize: 10, fontWeight: "700", color: Color.gold },
  muscleTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: Spacing.xs },
  muscleTagChip: { borderRadius: Radius.pill, backgroundColor: Color.goldWeak, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  muscleTagChipText: { fontSize: 10, fontWeight: "600", color: Color.gold },
  skipRow: { alignItems: "center", marginTop: Spacing.sm, paddingVertical: 6 },
  skipText: { fontSize: 12, color: Color.textFaint },
  toolsRow: { flexDirection: "row", gap: Spacing.sm },
  toolCard: { flex: 1 },
  toolCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  toolCardText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  trendPicker: { marginBottom: Spacing.sm },
  trendChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6, marginRight: Spacing.xs },
  trendChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  trendChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  trendChipTextActive: { color: Color.gold },
  metricRow: { flexDirection: "row", gap: 6, marginBottom: Spacing.sm },
  metricChip: { flex: 1, alignItems: "center", borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingVertical: 6 },
  metricChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  metricChipText: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  metricChipTextActive: { color: Color.gold },
  rangeRow: { flexDirection: "row", gap: 6, marginBottom: Spacing.sm },
  rangeChip: { flex: 1, alignItems: "center", borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingVertical: 5 },
  rangeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  rangeChipText: { fontSize: 10, fontWeight: "600", color: Color.textMuted },
  rangeChipTextActive: { color: Color.gold },
  trendCard: { padding: Spacing.md, alignItems: "center" },
  viewHistoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: Spacing.sm, paddingVertical: 6 },
  viewHistoryText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  dayDetailCard: { padding: Spacing.md, marginTop: Spacing.sm },
  dayDetailDate: { fontSize: 13, fontWeight: "600", color: Color.textSecondary, marginBottom: Spacing.sm },
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
