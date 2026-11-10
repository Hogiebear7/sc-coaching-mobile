import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile, PillButton, RangePills, RoundIconButton, SectionTitle, TileGrid } from "@/components/app/primitives";
import { Button } from "@/components/ui/Button";
import { DateStrip } from "@/components/ui/DateStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExerciseSwapSheet } from "@/components/ui/ExerciseSwapSheet";
import { ProgramDayCard } from "@/components/ui/ProgramDayCard";
import { Segmented } from "@/components/ui/Segmented";
import { SessionCard } from "@/components/ui/SessionCard";
import { TrendChart } from "@/components/ui/TrendChart";
import { AppRadius, AppSpace, appTitle } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { impactFeedback, selectionFeedback, tapFeedback } from "@/lib/haptics";
import { hasAccess } from "@/lib/member-access";
import { useAdvanceProgram, useMyProgram, useSetProgramStatus, type PrescribedExercise } from "@/lib/queries/programs";
import { useMemberAccess } from "@/lib/queries/profile";
import { useRestTimer } from "@/lib/rest-timer";
import { tourTarget, useTourScroll } from "@/lib/tour-registry";
import { useWorkoutDraft } from "@/lib/workout-draft";
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
import { makeStyles, useAppTheme } from "@/lib/theme";
import { CAN_SELL_DIGITAL_PLAN, DIGITAL_PLAN_ROUTE } from "@/lib/upsell-config";

// A deliberately narrow slice of the full EXERCISE_METRICS list (which also
// has Volume/Best Set Vol./Sets) — this compact widget covers just
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

const AI_CALLOUT_KEY_PREFIX = "workouts-ai-callout-seen-v1-";

// One-time, dismiss-and-forget — same mechanism as Log Food's Photo callout
// and Community's discoverability notice (local AsyncStorage seen-flag, no
// context, no secondary action).
function AiCalloutModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.calloutBackdrop}>
        <View style={styles.calloutCard}>
          <Text style={styles.calloutBody}>
            Your programme can adapt, not just log. Generate a session or swap any exercise that
            doesn&apos;t fit today.
          </Text>
          <Button title="Got it" onPress={onDismiss} style={{ marginTop: 16 }} />
        </View>
      </View>
    </Modal>
  );
}

export default function WorkoutsScreen() {
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();
  const router = useRouter();
  // A resumable session already exists in the workout-draft context the
  // moment any set/timer/title is present (see hasContent's own definition)
  // — this screen just wasn't reading it, so "Log a workout" always showed
  // even when tapping it would have resumed an in-progress session rather
  // than started a new one, confusing testers who'd left the app mid-workout.
  const { hasContent: hasActiveWorkout } = useWorkoutDraft();
  const { user } = useAuth();
  const restTimer = useRestTimer();
  const access = useMemberAccess();
  const canGenerate = hasAccess(access, "workoutGenerate");
  const { data, isLoading, isError, refetch, isRefetching } = useWorkouts();
  const { data: program } = useMyProgram();
  const advanceProgram = useAdvanceProgram();
  const setProgramStatus = useSetProgramStatus();
  const [trendExercise, setTrendExercise] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<PrescribedExercise | null>(null);

  const [aiCalloutVisible, setAiCalloutVisible] = useState(false);
  const aiCalloutKey = user && canGenerate ? AI_CALLOUT_KEY_PREFIX + user.id : null;
  useEffect(() => {
    if (!aiCalloutKey) return;
    let cancelled = false;
    AsyncStorage.getItem(aiCalloutKey)
      .then((seen) => {
        if (!cancelled && !seen) setAiCalloutVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [aiCalloutKey]);
  function dismissAiCallout() {
    setAiCalloutVisible(false);
    if (aiCalloutKey) AsyncStorage.setItem(aiCalloutKey, "1").catch(() => {});
  }

  // This tab stays mounted in the background rather than unmounting when
  // the member navigates away to Log Workout — so the mutation-time
  // invalidation in useCreateWorkout should already refresh it, but that
  // depends on this screen still being an active query observer at that
  // exact moment (e.g. not mid-transition). Refetching on every focus is
  // the standard, unconditional guarantee: a member coming back to this
  // tab after logging (or editing/deleting) a workout always sees it,
  // regardless of any invalidation timing edge case.
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const today = todayDateString();
  const dateWindow = useMemo(() => recentDates(21, today), [today]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showRationale, setShowRationale] = useState(false);

  const markedDates = useMemo(() => new Set((data?.sessions ?? []).map((s) => s.date)), [data]);
  const sectionByExerciseId = useMemo(
    () => new Map((data?.exerciseLibrary ?? []).map((e) => [e.id, e.section])),
    [data]
  );
  const sessionsForSelectedDate = useMemo(
    () => (data?.sessions ?? []).filter((s) => s.date === selectedDate),
    [data, selectedDate]
  );

  const currentDay = program?.days[program.currentDayIndex] ?? null;
  // A checkpoint replaces the normal day content only on the first day of
  // the week it's due — completedCycles + 1 is the current week number,
  // same math as the "Week X of Y" label rendered below.
  const currentWeekNumber = (program?.completedCycles ?? 0) + 1;
  const dueCheckpoint =
    program && program.currentDayIndex === 0
      ? (program.testCheckpoints ?? []).find((c) => c.weekNumber === currentWeekNumber) ?? null
      : null;
  const displayDay = dueCheckpoint?.day ?? currentDay;

  function handleMarkDayComplete() {
    if (!program) return;
    tapFeedback();
    advanceProgram.mutate(program.id);
  }

  // Pause/Resume are reversible — no destructive styling, matching this
  // app's existing Archive-vs-Delete convention (workout-template-builder.tsx).
  function handlePauseProgramme() {
    if (!program) return;
    Alert.alert("Pause programme?", "You can resume it any time from here.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Pause",
        onPress: () => {
          tapFeedback();
          setProgramStatus.mutate({ id: program.id, status: "paused" });
        },
      },
    ]);
  }

  function handleResumeProgramme() {
    if (!program) return;
    Alert.alert("Resume programme?", "Picks back up right where you left off.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Resume",
        onPress: () => {
          tapFeedback();
          setProgramStatus.mutate({ id: program.id, status: "active" });
        },
      },
    ]);
  }

  // Cancel is permanent (from here) — destructive styling, matching this
  // app's Delete convention.
  function handleCancelProgramme() {
    if (!program) return;
    Alert.alert("Cancel programme?", "This moves it to your Archive. This can't be undone from here.", [
      { text: "Never mind", style: "cancel" },
      {
        text: "Cancel programme",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          setProgramStatus.mutate({ id: program.id, status: "archived" });
        },
      },
    ]);
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

  // Member-curated quick-view chips (see progression-exercises-edit.tsx),
  // capped at 3. Falls back to the top 3 auto-derived candidates until the
  // member has pinned anything, so the row is never empty on first use.
  const progressionChips = useMemo(() => {
    const pinned = data?.pinnedProgressionExercises ?? [];
    if (pinned.length > 0) return pinned.map((name) => ({ key: name.toLowerCase(), name }));
    return trendCandidates.slice(0, 3);
  }, [data, trendCandidates]);

  const activeTrendExercise = trendExercise ?? progressionChips[0]?.name ?? trendCandidates[0]?.name ?? null;

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

  const scrollRef = useRef<ScrollView>(null);
  useTourScroll("workouts", scrollRef);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your workouts.</Text>
          <PillButton title="Try again" variant="secondary" onPress={() => refetch()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const canImport = hasAccess(access, "trackerImport");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.text} />}
      >
        {/* Header band: title, quick buttons, this week at a glance, day strip */}
        <View style={styles.band} {...tourTarget("train.week")}>
          <View style={styles.headerRow}>
            <Text style={appTitle(34, colors.text)}>Train</Text>
            <View style={styles.headerActions} {...tourTarget("train.actions")}>
              <RoundIconButton icon="time-outline" label="Workout history" onPress={() => router.push("/workout-history")} />
              <RoundIconButton
                icon={hasActiveWorkout ? "play" : "add"}
                label={hasActiveWorkout ? "Continue workout" : "Log a workout"}
                onPress={() => router.push("/log-workout")}
              />
            </View>
          </View>

          {weeklyStats ? (
            <View style={styles.weekRow} accessibilityRole="summary">
              <WeekFigure value={String(weeklyStats.workoutCount)} label="Workouts" color={dc.sessions} />
              <WeekFigure value={String(weeklyStats.totalSets)} label="Sets" color={dc.load} />
              <WeekFigure
                value={weeklyStats.totalVolume > 0 ? weeklyStats.totalVolume.toLocaleString() : "0"}
                label="kg volume"
                color={dc.weight}
              />
            </View>
          ) : null}

          <View style={{ marginTop: 18 }}>
            <DateStrip dates={dateWindow} selectedDate={selectedDate} today={today} markedDates={markedDates} onSelect={setSelectedDate} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Selected day */}
          <View style={styles.section}>
            <SectionTitle title={selectedDate === today ? "Today" : formatLongDate(selectedDate)} />
            {sessionsForSelectedDate.length > 0 ? (
              sessionsForSelectedDate.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  showDate={false}
                  onPress={() => router.push({ pathname: "/session-detail", params: { id: s.id } })}
                  sectionByExerciseId={sectionByExerciseId}
                />
              ))
            ) : (
              <View style={styles.card}>
                <EmptyState
                  icon={hasActiveWorkout ? "play-circle-outline" : "barbell-outline"}
                  title={
                    hasActiveWorkout ? "Workout in progress" : selectedDate === today ? "Nothing logged today" : "Nothing logged this day"
                  }
                  body={hasActiveWorkout ? "Pick up where you left off." : "Log a workout, or start a saved template from your library."}
                  actionLabel={hasActiveWorkout ? "Continue workout" : "Log a workout"}
                  onAction={() => router.push({ pathname: "/log-workout", params: { date: selectedDate } })}
                  variant="primary"
                />
              </View>
            )}
          </View>

          {/* Programme */}
          {program && program.status === "paused" ? (
            <View style={styles.section} {...tourTarget("train.programme")}>
              <SectionTitle title="Your programme" />
              <View style={styles.card}>
                <View style={styles.programHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.programName}>{program.name}</Text>
                    <Text style={styles.programMeta}>Paused</Text>
                  </View>
                  <IconTap icon="close" label="Cancel programme" onPress={handleCancelProgramme} />
                </View>
                <Text style={styles.programHint}>Resume when you&apos;re ready to pick back up where you left off.</Text>
                <Button title="Resume programme" onPress={handleResumeProgramme} loading={setProgramStatus.isPending} style={{ marginTop: 16 }} />
              </View>
            </View>
          ) : program && currentDay ? (
            <View style={styles.section} {...tourTarget("train.programme")}>
              <SectionTitle title="Your programme" />
              <View style={styles.card}>
                <View style={styles.programHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.programName}>{program.name}</Text>
                    {program.source === "ai" && program.totalWeeks ? (
                      <Text style={styles.programMeta}>
                        Week {Math.min((program.completedCycles ?? 0) + 1, program.totalWeeks)} of {program.totalWeeks}
                      </Text>
                    ) : null}
                  </View>
                  <IconTap icon="pause" label="Pause programme" onPress={handlePauseProgramme} />
                  <IconTap icon="close" label="Cancel programme" onPress={handleCancelProgramme} />
                </View>

                {program.source === "ai" && program.totalWeeks ? (
                  <View style={styles.weekProgress}>
                    {Array.from({ length: program.totalWeeks }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.weekProgressSeg,
                          i < (program.completedCycles ?? 0) && { backgroundColor: dc.sessions },
                          i === (program.completedCycles ?? 0) && { backgroundColor: colors.text },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}

                {program.aiMeta?.rationale ? (
                  <Pressable onPress={() => setShowRationale((v) => !v)} style={styles.rationaleToggle} accessibilityRole="button">
                    <Text style={styles.rationaleToggleText}>Why this programme</Text>
                    <Ionicons name={showRationale ? "chevron-up" : "chevron-down"} size={14} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
                {program.aiMeta?.rationale && showRationale ? <Text style={styles.rationaleText}>{program.aiMeta.rationale}</Text> : null}

                {program.source === "ai" && (program.completedCycles ?? 0) > 0 ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/programme-checkin",
                        params: { programId: program.id, cycleIndex: String((program.completedCycles ?? 0) - 1) },
                      })
                    }
                    style={styles.checkinBanner}
                    accessibilityRole="button"
                  >
                    <Ionicons name="flag-outline" size={16} color={colors.text} />
                    <Text style={styles.checkinBannerText}>Week {program.completedCycles} check-in ready</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}

                <View style={styles.dayHeader}>
                  {dueCheckpoint ? <Text style={styles.checkpointTag}>Check-in test</Text> : null}
                  <Text style={styles.programDayLabel}>{displayDay!.label}</Text>
                </View>

                <ProgramDayCard
                  day={displayDay!}
                  onRequestSwap={program.source === "ai" && displayDay!.type === "workout" ? (ex) => setSwapTarget(ex) : undefined}
                />

                {displayDay!.type === "rest" ? (
                  <Button
                    title="Mark rest day done"
                    variant="secondary"
                    onPress={handleMarkDayComplete}
                    loading={advanceProgram.isPending}
                    style={{ marginTop: 16 }}
                  />
                ) : (
                  <>
                    <Button
                      title={dueCheckpoint ? "Start test" : "Start workout"}
                      onPress={() => {
                        impactFeedback();
                        router.push({
                          pathname: "/log-workout",
                          params: { programId: program.id, dayId: displayDay!.id, title: displayDay!.label },
                        });
                      }}
                      style={{ marginTop: 16 }}
                    />
                    <Pressable onPress={handleMarkDayComplete} style={styles.skipRow} accessibilityRole="button">
                      <Text style={styles.skipText}>Skip to next day</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ) : null}

          {/* Tools */}
          <View style={styles.section} {...tourTarget("train.tools")}>
            <SectionTitle title="Tools" />
            <View style={styles.toolsRow}>
              <ToolButton icon="barbell-outline" label="Plates" onPress={() => router.push("/plate-calculator")} />
              <ToolButton
                icon="timer-outline"
                label="Rest timer"
                onPress={() => {
                  if (!restTimer.isRunning) restTimer.reset(90);
                  router.push({ pathname: "/rest-timer" });
                }}
              />
              <ToolButton
                icon="sparkles-outline"
                label="Generate"
                locked={!canGenerate}
                onPress={() => (canGenerate ? router.push("/workout-generator") : CAN_SELL_DIGITAL_PLAN && router.push(DIGITAL_PLAN_ROUTE as never))}
              />
              <ToolButton
                icon="watch-outline"
                label="Import"
                locked={!canImport}
                onPress={() => (canImport ? router.push("/tracker-import") : CAN_SELL_DIGITAL_PLAN && router.push(DIGITAL_PLAN_ROUTE as never))}
              />
            </View>
          </View>

          {/* Recent records */}
          {recentRecords.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle
                title="Recent records"
                action={allRecentRecords.length > 3 ? "See more" : undefined}
                onAction={() => router.push({ pathname: "/workout-records" })}
              />
              <View style={styles.list}>
                {recentRecords.map((r, idx) => (
                  <Pressable
                    key={`${r.exerciseName}-${r.type}-${r.date}`}
                    onPress={() => router.push({ pathname: "/exercise-detail", params: { name: r.exerciseName } })}
                    style={({ pressed }) => [styles.row, idx > 0 && styles.rowDivider, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <View style={styles.recordIcon}>
                      <Ionicons name="trophy" size={16} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {r.exerciseName}
                      </Text>
                      <Text style={styles.rowSub}>
                        {r.label} · {formatShortDate(r.date)}
                      </Text>
                    </View>
                    <Text style={styles.rowValue}>{r.value}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Personal bests */}
          {data.personalBests.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                title="Personal bests"
                action={pinnedBests.length > 0 ? "Edit" : "Choose"}
                onAction={() => router.push("/personal-bests-edit")}
              />
              {pinnedBests.length > 0 ? (
                <TileGrid>
                  {pinnedBests.map((pb) => (
                    <MetricTile
                      key={pb.exerciseName}
                      title={pb.exerciseName}
                      window={pb.heaviestWeight ? "Heaviest weight" : "Most reps"}
                      value={pb.heaviestWeight ? pb.heaviestWeight.weightStr : pb.highestReps ? String(pb.highestReps.reps) : null}
                      unit={pb.heaviestWeight ? undefined : "reps"}
                      color={dc.sessions}
                      note="Tap for reps, sets and history"
                      onPress={() => router.push({ pathname: "/exercise-detail", params: { name: pb.exerciseName } })}
                    />
                  ))}
                </TileGrid>
              ) : (
                <View style={styles.card}>
                  <EmptyState
                    icon="trophy-outline"
                    title="No personal bests yet"
                    body="Pick up to 5 lifts to feature here and track them at a glance."
                    actionLabel="Choose your lifts"
                    onAction={() => router.push("/personal-bests-edit")}
                  />
                </View>
              )}
            </View>
          )}

          {/* Progression */}
          {data.sessions.length > 0 && trendCandidates.length === 0 ? (
            <View style={styles.section}>
              <SectionTitle title="Progression" />
              <View style={styles.card}>
                <EmptyState
                  icon="trending-up-outline"
                  title="Not enough data yet"
                  body="Log the same exercise a couple more times to unlock your progression trend."
                />
              </View>
            </View>
          ) : null}

          {trendCandidates.length > 0 && activeTrendExercise ? (
            <View style={styles.section}>
              <SectionTitle title="Progression" action="Edit" onAction={() => router.push("/progression-exercises-edit")} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {progressionChips.map((c) => {
                  const active = activeTrendExercise === c.name;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => {
                        if (!active) selectionFeedback();
                        setTrendExercise(c.name);
                        setTrendMetric(null);
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => router.push("/progression-exercises-edit")} style={styles.chip} accessibilityRole="button">
                  <Ionicons name="search" size={14} color={colors.text} />
                  <Text style={styles.chipText}>Search</Text>
                </Pressable>
              </ScrollView>
              <View style={styles.card}>
                <View style={styles.trendHead}>
                  <Text style={styles.trendTitle} numberOfLines={1}>
                    {activeTrendExercise}
                  </Text>
                  {availableMetrics.length > 1 ? (
                    <View style={{ width: 180 }}>
                      <Segmented
                        options={availableMetrics.map((m) => m.key)}
                        value={activeTrendMetric}
                        onChange={(k) => setTrendMetric(k)}
                        format={(k) => COMPACT_TREND_METRICS.find((m) => m.key === k)?.label ?? k}
                      />
                    </View>
                  ) : null}
                </View>
                <TrendChart points={filteredTrendPoints} />
                <View style={{ marginTop: 12 }}>
                  <RangePills options={TREND_RANGES.map((r) => r.key)} value={trendRange} onChange={setTrendRange} />
                </View>
              </View>
              <Pressable
                onPress={() => router.push({ pathname: "/exercise-detail", params: { name: activeTrendExercise } })}
                style={styles.linkRow}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>View full {activeTrendExercise} history</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          {/* Recent sessions */}
          <View style={styles.section}>
            <SectionTitle
              title="Recent sessions"
              action={data.sessions.length > 0 ? "See all" : undefined}
              onAction={() => router.push("/workout-history")}
            />
            {data.sessions.length === 0 ? (
              <View style={styles.card}>
                <EmptyState
                  icon={hasActiveWorkout ? "play-circle-outline" : "barbell-outline"}
                  title={hasActiveWorkout ? "Workout in progress" : "No workouts logged yet"}
                  body={hasActiveWorkout ? "Pick up where you left off." : "Log your first workout to start building your training history."}
                  actionLabel={hasActiveWorkout ? "Continue workout" : "Log your first workout"}
                  onAction={() => router.push("/log-workout")}
                  variant="primary"
                />
              </View>
            ) : (
              data.sessions
                .slice(0, 5)
                .map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onPress={() => router.push({ pathname: "/session-detail", params: { id: s.id } })}
                    sectionByExerciseId={sectionByExerciseId}
                  />
                ))
            )}
          </View>

          {/* More */}
          <View style={styles.section}>
            <SectionTitle title="More training" />
            <View style={styles.list}>
              {MORE_ROWS.map((r, i) => (
                <Pressable
                  key={r.href}
                  onPress={() => {
                    tapFeedback();
                    router.push(r.href as never);
                  }}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Ionicons name={r.icon} size={22} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{r.title}</Text>
                    <Text style={styles.rowSub}>{r.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <ExerciseSwapSheet
        visible={swapTarget !== null}
        onClose={() => setSwapTarget(null)}
        programId={program?.id ?? ""}
        dayId={displayDay?.id ?? ""}
        exercise={swapTarget}
      />
      <AiCalloutModal visible={aiCalloutVisible} onDismiss={dismissAiCallout} />
    </SafeAreaView>
  );
}

const MORE_ROWS: { href: string; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { href: "/workout-trends", icon: "trending-up-outline", title: "Training trends", sub: "Sets and volume over time" },
  { href: "/workout-library", icon: "albums-outline", title: "Workout library", sub: "Your saved, reusable workouts" },
  { href: "/workout-history", icon: "time-outline", title: "Workout history", sub: "Every session you've logged" },
  { href: "/set-levels", icon: "body-outline", title: "Set levels", sub: "Weekly sets by muscle group" },
];

function WeekFigure({ value, label, color }: { value: string; label: string; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.weekFigure} accessible accessibilityLabel={`${value} ${label} this week`}>
      <View style={[styles.weekDot, { backgroundColor: color }]} />
      <Text style={styles.weekValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.weekLabel}>{label}</Text>
    </View>
  );
}

// Round shortcut with a caption — the same shape as the "+" sheet's quick
// actions. Locked tools show a padlock badge and lead to Membership.
function ToolButton({
  icon,
  label,
  onPress,
  locked = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  locked?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={locked ? (CAN_SELL_DIGITAL_PLAN ? `${label}, upgrade to unlock` : `${label}, not included in your plan`) : label}
    >
      <View style={styles.toolIcon}>
        <Ionicons name={icon} size={24} color={locked ? colors.textMuted : colors.text} />
        {locked ? (
          <View style={styles.toolLock}>
            <Ionicons name="lock-closed" size={10} color={colors.onPrimary} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.toolLabel, locked && { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function IconTap({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.iconTap} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    errorText: { color: c.textMuted, fontSize: 16 },
    calloutBackdrop: { flex: 1, backgroundColor: c.scrim, alignItems: "center", justifyContent: "center", padding: 24 },
    calloutCard: { width: "100%", maxWidth: 360, borderRadius: AppRadius.card, backgroundColor: c.surface, padding: 20 },
    calloutBody: { fontSize: 16, color: c.text, lineHeight: 23 },

    scroll: { paddingBottom: 40 },
    band: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingHorizontal: AppSpace.gutter,
      paddingBottom: 20,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 },
    headerActions: { flexDirection: "row", gap: 10 },
    weekRow: { flexDirection: "row", marginTop: 20, gap: 10 },
    weekFigure: { flex: 1, backgroundColor: c.surfaceHi, borderRadius: AppRadius.card, paddingVertical: 14, paddingHorizontal: 12 },
    weekDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
    weekValue: { fontSize: 26, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"] },
    weekLabel: { fontSize: 14, color: c.textMuted, marginTop: 2 },

    body: { paddingHorizontal: AppSpace.gutter, paddingTop: AppSpace.section },
    section: { marginBottom: AppSpace.section },
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16 },

    programHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
    programName: { fontSize: 18, fontWeight: "600", color: c.text },
    programMeta: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    programHint: { fontSize: 15, color: c.textSecondary, marginTop: 10, lineHeight: 21 },
    iconTap: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.control, alignItems: "center", justifyContent: "center", marginLeft: 6 },
    weekProgress: { flexDirection: "row", gap: 4, marginTop: 14 },
    weekProgressSeg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.control },
    rationaleToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14, alignSelf: "flex-start", minHeight: 32 },
    rationaleToggleText: { fontSize: 14, fontWeight: "500", color: c.textSecondary, textDecorationLine: "underline" },
    rationaleText: { fontSize: 15, color: c.textSecondary, marginTop: 4, lineHeight: 21 },
    checkinBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 14,
      minHeight: 44,
      borderRadius: AppRadius.inner,
      backgroundColor: c.control,
    },
    checkinBannerText: { flex: 1, fontSize: 15, fontWeight: "500", color: c.text },
    dayHeader: { marginTop: 18, marginBottom: 8 },
    checkpointTag: { fontSize: 13, fontWeight: "600", color: c.textSecondary, marginBottom: 2 },
    programDayLabel: { fontSize: 21, fontWeight: "600", color: c.text },
    skipRow: { alignItems: "center", marginTop: 8, minHeight: 40, justifyContent: "center" },
    skipText: { fontSize: 14, color: c.textMuted, textDecorationLine: "underline" },

    toolsRow: { flexDirection: "row", justifyContent: "space-between" },
    tool: { alignItems: "center", width: 80 },
    toolIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    toolLock: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.textMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    toolLabel: { marginTop: 8, fontSize: 14, color: c.text },

    list: { backgroundColor: c.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    rowTitle: { fontSize: 16, color: c.text },
    rowSub: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    rowValue: { fontSize: 17, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    recordIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    pressed: { opacity: 0.8 },

    chipRow: { gap: 8, paddingBottom: 12 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: AppRadius.control,
      backgroundColor: c.control,
    },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 15, fontWeight: "500", color: c.text },
    chipTextActive: { color: c.onPrimary },
    trendHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
    trendTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: c.text },
    linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 44, marginTop: 4 },
    linkText: { fontSize: 15, color: c.textSecondary, textDecorationLine: "underline" },
  })
);
