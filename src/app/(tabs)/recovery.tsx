import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile, PillButton, RoundIconButton, SectionTitle, TileGrid, WeekStrip } from "@/components/app/primitives";
import { Button } from "@/components/ui/Button";
import { Collapsible } from "@/components/ui/Collapsible";
import { ContinueWorkoutPill } from "@/components/ui/ContinueWorkoutPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoModal } from "@/components/ui/InfoModal";
import { Stepper } from "@/components/ui/Stepper";
import { AppRadius, AppSpace, appTitle, readinessColor } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { hasAccess } from "@/lib/member-access";
import { useMemberTier } from "@/lib/queries/profile";
import { useLogRecovery, useRecovery, type RecoveryLogSummary } from "@/lib/queries/recovery";
import { makeStyles, useAppTheme } from "@/lib/theme";

const WEEK_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function isoToDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readinessWord(score: number): string {
  if (score >= 80) return "Primed";
  if (score >= 60) return "Ready";
  if (score >= 40) return "Steady";
  return "Ease off";
}

// Editable check-in form — used both for today's entry and for reopening a
// past log. The backend upserts by (userId, date), so resubmitting for a
// date that already has a log just updates it in place.
function CheckInForm({
  date,
  existingLog,
  isToday,
  initialSleepHours,
  onDone,
}: {
  date: string;
  existingLog: RecoveryLogSummary | null;
  isToday: boolean;
  /** From Import from Tracker (tracker-import.tsx) — a sleep-hours reading
   *  pulled from a photo of the member's own tracker app, offered as a
   *  starting point they can still adjust before saving. */
  initialSleepHours?: number;
  onDone?: () => void;
}) {
  const styles = useStyles();
  const [sleepHours, setSleepHours] = useState(initialSleepHours ?? existingLog?.sleepHours ?? 7);
  const [sleepQuality, setSleepQuality] = useState(existingLog?.sleepQuality ?? 5);
  const [soreness, setSoreness] = useState(existingLog?.soreness ?? 5);
  const [fatigue, setFatigue] = useState(existingLog?.fatigue ?? 3);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const logRecovery = useLogRecovery();

  async function submit() {
    setError(null);
    setSaved(false);
    try {
      const res = await logRecovery.mutateAsync({
        date,
        sleepHours,
        sleepQuality,
        soreness,
        fatigue,
      });
      if (!res.success) setError(res.message);
      else {
        successFeedback();
        setSaved(true);
        onDone?.();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{isToday ? "Today's check-in" : `Check-in for ${formatDate(date)}`}</Text>
        {!isToday && onDone ? (
          <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button">
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
      <Stepper label="Sleep hours" value={sleepHours} onChange={setSleepHours} min={0} max={12} step={0.5} suffix="h" />
      <Stepper label="Sleep quality" caption="1 = poor · 10 = excellent" value={sleepQuality} onChange={setSleepQuality} min={1} max={10} />
      <Stepper label="Soreness" caption="1 = none · 10 = very sore" value={soreness} onChange={setSoreness} min={1} max={10} />
      <Stepper label="Fatigue" caption="1 = fresh · 5 = exhausted" value={fatigue} onChange={setFatigue} min={1} max={5} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved && !error ? <Text style={styles.saved}>Saved.</Text> : null}
      <Button title={existingLog ? "Update check-in" : "Save check-in"} onPress={submit} loading={logRecovery.isPending} style={{ marginTop: 12 }} />
    </View>
  );
}

export default function RecoveryScreen() {
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();
  const router = useRouter();
  const tier = useMemberTier();
  const { prefillSleepHours } = useLocalSearchParams<{ prefillSleepHours?: string }>();
  const parsedPrefillSleepHours = prefillSleepHours ? Number(prefillSleepHours) : NaN;
  const { data, isLoading, isError, refetch, isRefetching } = useRecovery();
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [loadInfoOpen, setLoadInfoOpen] = useState(false);

  // Last seven days ending today, one readiness bar each.
  const week = useMemo(() => {
    if (!data) return [];
    const byDate = new Map(data.logs.map((l) => [l.date, l]));
    const today = isoToDate(data.todayISO);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const log = byDate.get(isoOf(d));
      return {
        letter: WEEK_LETTERS[d.getDay()],
        date: d.getDate(),
        score: log?.readinessScore ?? null,
        sleep: log?.sleepHours ?? null,
        isToday: i === 6,
      };
    });
  }, [data]);

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
          <Text style={styles.errorText}>Couldn&apos;t load recovery data.</Text>
          <PillButton title="Try again" variant="secondary" onPress={() => refetch()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const todayLog = data.logs.find((l) => l.date === data.todayISO) ?? null;
  const editingLog = editingDate ? (data.logs.find((l) => l.date === editingDate) ?? null) : null;
  // latestReadinessScore/latestGuidance are the most recent check-in EVER,
  // not necessarily today's — hasLoggedToday is what actually answers "is
  // this score for today."
  const todayScore = data.hasLoggedToday ? data.latestReadinessScore : null;
  const recentScores = week.map((d) => d.score);
  const lastSleep = data.logs.find((l) => l.sleepHours != null)?.sleepHours ?? null;
  const sleepBars = week.map((d) => d.sleep);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.text} />}
      >
        <View style={styles.band}>
          <View style={styles.headerRow}>
            <Text style={appTitle(34, colors.text)}>Recovery</Text>
            <View style={styles.headerActions}>
              <ContinueWorkoutPill />
              <RoundIconButton icon="stats-chart-outline" label="Readiness trend" onPress={() => router.push("/readiness" as never)} />
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            <WeekStrip days={week} />
          </View>

          <View style={styles.readiness}>
            <Text style={styles.readinessLabel}>Readiness today</Text>
            {todayScore !== null ? (
              <View style={styles.readinessRow}>
                <Text style={[styles.readinessScore, { color: readinessColor(todayScore, dc, colors.textMuted) }]}>{todayScore}</Text>
                <Text style={styles.readinessWord}>{readinessWord(todayScore)}</Text>
              </View>
            ) : (
              <Text style={styles.readinessWord}>Not checked in yet</Text>
            )}
            <Text style={styles.guidance}>
              {data.hasLoggedToday && data.latestGuidance
                ? data.latestGuidance
                : "Log today's check-in below and we'll tell you how ready your body is to train."}
            </Text>
            {data.phaseNote ? <Text style={styles.phaseNote}>{data.phaseNote}</Text> : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <SectionTitle title="This week" action="Trend" onAction={() => router.push("/readiness" as never)} />
            <TileGrid>
              <MetricTile
                title="Readiness"
                window="Last 7 days"
                value={todayScore !== null ? String(todayScore) : null}
                color={dc.readinessHigh}
                bars={recentScores}
                note="Check in to start your trend"
                onPress={() => router.push("/readiness" as never)}
              />
              <MetricTile
                title="Training load"
                window="Rolling 7 days"
                value={data.rollingLoad.daysWithLoad > 0 ? data.rollingLoad.sevenDaySum.toLocaleString() : null}
                unit="AU"
                color={dc.load}
                note="Log workouts with an RPE to build this"
                onPress={() => setLoadInfoOpen(true)}
              />
              <MetricTile
                title="Sleep"
                window="Last check-in"
                value={lastSleep !== null ? String(lastSleep) : null}
                unit="h"
                color={dc.sleep}
                bars={sleepBars}
                note="Add sleep hours to your check-in"
                onPress={() => router.push("/sleep-trend" as never)}
              />
              <MetricTile
                title="Check-ins"
                window="Last 7 days"
                value={String(recentScores.filter((s) => s !== null).length)}
                unit="of 7"
                color={dc.sessions}
                bars={recentScores.map((s) => (s === null ? null : 1))}
              />
            </TileGrid>
          </View>

          <InfoModal
            visible={loadInfoOpen}
            onClose={() => setLoadInfoOpen(false)}
            title="7-Day Load"
            body={
              "Training duration × RPE, added up over a rolling 7-day window ending today. Pulled from your logged " +
              "workouts (duration and how-did-that-feel RPE), or your recovery check-in's own numbers if you filled " +
              "those in instead. Days you don't log anything simply add nothing — a quiet week, a rest day, or a " +
              "brand-new account all show a lower number rather than a broken one. It resets naturally as old days " +
              "roll out of the window, so you're always seeing your most recent week, not a running total.\n\n" +
              "Where you land:\n" +
              "· Under 1,000 — Light. A couple of easy sessions or a deload week.\n" +
              "· 1,000–2,399 — Moderate. A normal, sustainable training week.\n" +
              "· 2,400+ — High. Roughly five hard hour-long sessions — a big week.\n\n" +
              "A high number isn't automatically a bad thing — it just means you've accumulated a lot of work. What " +
              "matters is how it sits against your readiness: a high load paired with low readiness is the combination " +
              "the app watches for and trims your next session down for, since that's when the injury/burnout risk " +
              "actually shows up."
            }
          />

          <View style={styles.section}>
            <SectionTitle
              title={editingDate === null ? "Check in" : "Edit check-in"}
              action={editingDate === null && hasAccess(tier, "trackerImport") ? "Import sleep" : undefined}
              onAction={() => router.push("/tracker-import")}
            />
            {editingDate === null ? (
              <CheckInForm
                date={data.todayISO}
                existingLog={todayLog}
                isToday
                initialSleepHours={Number.isFinite(parsedPrefillSleepHours) ? parsedPrefillSleepHours : undefined}
              />
            ) : (
              <CheckInForm
                date={editingDate}
                existingLog={editingLog}
                isToday={editingDate === data.todayISO}
                onDone={() => setEditingDate(null)}
              />
            )}
          </View>

          <View style={styles.section}>
            <SectionTitle title="History" />
            {data.logs.length === 0 ? (
              <View style={styles.card}>
                <EmptyState icon="moon-outline" title="No check-ins logged yet" body="Log a check-in above to start building your recovery history." />
              </View>
            ) : (
              <View style={styles.list}>
                {data.logs.slice(0, 7).map((log, i) => {
                  const active = log.date === editingDate;
                  return (
                    <Pressable
                      key={log.id}
                      onPress={() => {
                        tapFeedback();
                        setEditingDate(active ? null : log.date);
                      }}
                      style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, active && styles.rowActive, pressed && { opacity: 0.8 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatDate(log.date)}, readiness ${log.readinessScore ?? "not scored"}. Tap to edit.`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{formatDate(log.date)}</Text>
                        <Text style={styles.rowSub}>
                          {log.sleepHours != null ? `${log.sleepHours}h sleep` : "No sleep logged"}
                          {log.soreness != null ? ` · soreness ${log.soreness}/10` : ""}
                          {log.fatigue != null ? ` · fatigue ${log.fatigue}/5` : ""}
                        </Text>
                      </View>
                      <View style={[styles.dot, { backgroundColor: readinessColor(log.readinessScore, dc, colors.textMuted) }]} />
                      <Text style={styles.rowScore}>{log.readinessScore ?? "—"}</Text>
                      <Ionicons name={active ? "create" : "create-outline"} size={18} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.card}>
              <Collapsible title="How your score works">
                <Text style={styles.help}>
                  Four inputs from today&apos;s check-in, each worth up to 25 points: last night&apos;s sleep duration (more is better,
                  up to 8h), sleep quality, soreness, and fatigue (both lower is better) — added up into a score out of 100.
                </Text>
                <Text style={[styles.help, styles.helpStrong]}>Where you land</Text>
                <Text style={styles.help}>· 80–100 — Well recovered. A good day to push intensity if your programme calls for it.</Text>
                <Text style={styles.help}>· 60–79 — Solid. Train as planned and pay attention to how you feel as you warm up.</Text>
                <Text style={styles.help}>
                  · 40–59 — Mixed. Consider an easier session or extra warm-up, especially if soreness or fatigue is high.
                </Text>
                <Text style={styles.help}>
                  · Under 40 — Low. Prioritise rest, mobility, or a light session — pushing hard now adds risk without much benefit.
                </Text>
              </Collapsible>
            </View>
          </View>

          <View style={styles.explainer}>
            <View style={styles.explainerHead}>
              <Ionicons name="bulb-outline" size={22} color={colors.text} />
              <Text style={styles.explainerTitle}>What helps recovery</Text>
            </View>
            <Text style={styles.explainerBody}>
              7–9 hours of sleep, a consistent wake time, enough protein, and light movement on high-soreness days. Training creates
              the stimulus; recovery is when you adapt. Watch out for max efforts on very sore or tired days, alcohol close to bedtime,
              and back-to-back hard sessions with no easy day between them.
            </Text>
            <Text style={styles.disclaimer}>Coaching guidance only, not medical advice. Consult a healthcare provider for any health concerns.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c, dc) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    errorText: { color: c.textMuted, fontSize: 16 },
    scroll: { paddingBottom: 40 },
    band: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingHorizontal: AppSpace.gutter,
      paddingBottom: 22,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    readiness: { marginTop: 18 },
    readinessLabel: { fontSize: 15, color: c.textMuted },
    readinessRow: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 2 },
    readinessScore: { fontSize: 40, fontWeight: "500", fontVariant: ["tabular-nums"] },
    readinessWord: { fontSize: 28, fontWeight: "600", color: c.text, marginTop: 2 },
    guidance: { fontSize: 16, lineHeight: 23, color: c.textSecondary, marginTop: 8 },
    phaseNote: { fontSize: 15, lineHeight: 21, color: c.textMuted, marginTop: 6 },

    body: { paddingHorizontal: AppSpace.gutter, paddingTop: AppSpace.section },
    section: { marginBottom: AppSpace.section },
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16 },
    formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    formTitle: { fontSize: 17, fontWeight: "600", color: c.text },
    linkText: { fontSize: 15, color: c.textSecondary, textDecorationLine: "underline" },
    error: { fontSize: 14, color: c.danger, marginTop: 8 },
    saved: { fontSize: 14, color: c.success, marginTop: 8 },

    list: { backgroundColor: c.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    rowActive: { backgroundColor: c.surfaceHi },
    rowTitle: { fontSize: 16, color: c.text },
    rowSub: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    rowScore: { fontSize: 17, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"], minWidth: 28, textAlign: "right" },
    dot: { width: 10, height: 10, borderRadius: 5 },

    help: { fontSize: 15, color: c.textSecondary, lineHeight: 21, marginTop: 8 },
    helpStrong: { marginTop: 14, fontWeight: "600", color: c.text },

    explainer: { borderRadius: AppRadius.card, padding: 18, backgroundColor: `${dc.readinessHigh}29` },
    explainerHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    explainerTitle: { fontSize: 18, fontWeight: "600", color: c.text },
    explainerBody: { marginTop: 8, fontSize: 15, lineHeight: 22, color: c.textSecondary },
    disclaimer: { marginTop: 12, fontSize: 13, lineHeight: 18, color: c.textMuted, fontStyle: "italic" },
  })
);
