import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Collapsible } from "@/components/ui/Collapsible";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReadinessRing } from "@/components/ui/ReadinessRing";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stepper } from "@/components/ui/Stepper";
import { Color, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { hasAccess } from "@/lib/member-access";
import { useMemberTier } from "@/lib/queries/profile";
import { useLogRecovery, useRecovery, type RecoveryLogSummary } from "@/lib/queries/recovery";

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
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
        setSaved(true);
        onDone?.();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <Card style={styles.formCard}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {isToday ? "Today's check-in" : `Check-in for ${formatDate(date)}`}
        </Text>
        {!isToday && onDone ? (
          <Pressable onPress={onDone} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
      <Stepper label="Sleep hours" value={sleepHours} onChange={setSleepHours} min={0} max={12} step={0.5} suffix="h" />
      <Stepper
        label="Sleep quality"
        caption="1 = poor · 10 = excellent"
        value={sleepQuality}
        onChange={setSleepQuality}
        min={1}
        max={10}
      />
      <Stepper
        label="Soreness"
        caption="1 = none · 10 = very sore"
        value={soreness}
        onChange={setSoreness}
        min={1}
        max={10}
      />
      <Stepper
        label="Fatigue"
        caption="1 = fresh · 5 = exhausted"
        value={fatigue}
        onChange={setFatigue}
        min={1}
        max={5}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved && !error ? <Text style={styles.saved}>Saved.</Text> : null}
      <Button
        title={existingLog ? "Update check-in" : "Save check-in"}
        onPress={submit}
        loading={logRecovery.isPending}
        style={styles.submit}
      />
    </Card>
  );
}

export default function RecoveryScreen() {
  const router = useRouter();
  const tier = useMemberTier();
  const { prefillSleepHours } = useLocalSearchParams<{ prefillSleepHours?: string }>();
  const parsedPrefillSleepHours = prefillSleepHours ? Number(prefillSleepHours) : NaN;
  const { data, isLoading, isError, refetch, isRefetching } = useRecovery();
  const [editingDate, setEditingDate] = useState<string | null>(null);

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
          <Text style={styles.errorText}>Couldn&apos;t load recovery data.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const todayLog = data.logs.find((l) => l.date === data.todayISO) ?? null;
  const editingLog = editingDate ? data.logs.find((l) => l.date === editingDate) ?? null : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
      >
        <Text style={styles.heading}>Recovery</Text>

        <Card style={styles.summaryCard} tier="hero">
          <View style={styles.summaryRow}>
            <ReadinessRing score={data.latestReadinessScore} size={88} />
            <View style={{ flex: 1 }}>
              {data.latestGuidance ? (
                <Text style={styles.guidance}>{data.latestGuidance}</Text>
              ) : (
                <Text style={styles.guidance}>
                  Log today&apos;s check-in below and we&apos;ll tell you how ready your body is to train.
                </Text>
              )}
              {data.phaseNote ? <Text style={styles.phaseNote}>{data.phaseNote}</Text> : null}
            </View>
          </View>
          <View style={styles.loadRow}>
            <Text style={styles.loadLabel}>7-day load</Text>
            <Text style={styles.loadValue}>
              {data.rollingLoad.daysWithLoad > 0 ? data.rollingLoad.sevenDaySum : "—"}
            </Text>
          </View>
          <Collapsible title="How your score works">
            <Text style={styles.scoreHelp}>
              We blend last night&apos;s sleep, how sore and fatigued you&apos;re feeling into a score out of
              100 — the higher it sits, the more ready your body is to push today.
            </Text>
          </Collapsible>
        </Card>

        {editingDate === null ? (
          <>
            {hasAccess(tier, "trackerImport") ? (
              <Pressable onPress={() => router.push("/tracker-import")} style={styles.importLink}>
                <Text style={styles.importLinkText}>Import sleep from your tracker</Text>
              </Pressable>
            ) : null}
            <CheckInForm
              date={data.todayISO}
              existingLog={todayLog}
              isToday
              initialSleepHours={Number.isFinite(parsedPrefillSleepHours) ? parsedPrefillSleepHours : undefined}
            />
          </>
        ) : (
          <CheckInForm date={editingDate} existingLog={editingLog} isToday={editingDate === data.todayISO} onDone={() => setEditingDate(null)} />
        )}

        <View style={styles.section}>
          <SectionHeader label="HISTORY" />
          {data.logs.length === 0 ? (
            <Card tier="quiet">
              <EmptyState
                icon="moon-outline"
                title="No check-ins logged yet"
                body="Log a check-in above to start building your recovery history."
              />
            </Card>
          ) : (
            data.logs.slice(0, 5).map((log) => (
              <Pressable
                key={log.id}
                onPress={() => setEditingDate(log.date === editingDate ? null : log.date)}
              >
                <Card style={[styles.logCard, log.date === editingDate && styles.logCardActive]} tier="compact">
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                    <Text style={styles.logMeta}>
                      {log.sleepHours != null ? `${log.sleepHours}h sleep` : "—"}
                      {log.soreness != null ? ` · soreness ${log.soreness}/10` : ""}
                      {log.fatigue != null ? ` · fatigue ${log.fatigue}/5` : ""}
                    </Text>
                  </View>
                  <Text style={styles.logScore}>{log.readinessScore ?? "—"}</Text>
                </Card>
              </Pressable>
            ))
          )}
        </View>

        <Card style={styles.referenceCard} tier="quiet">
          <Text style={styles.referenceTitle}>RECOVERY GUIDANCE</Text>
          <Text style={styles.referenceHeading}>What helps recovery</Text>
          <Text style={styles.referenceBody}>
            7–9 hours of sleep, a consistent wake time, adequate protein intake, and light movement on
            high-soreness days.
          </Text>
          <Text style={[styles.referenceHeading, { marginTop: Spacing.sm }]}>Why it matters</Text>
          <Text style={styles.referenceBody}>
            Training creates the stimulus, but recovery is when adaptation actually happens. Tracking your
            patterns lets your readiness score inform whether to push hard or take it lighter.
          </Text>
          <Text style={[styles.referenceHeading, { marginTop: Spacing.sm }]}>Common pitfalls</Text>
          <Text style={styles.referenceBody}>
            Going max effort on days with 3+ soreness or fatigue, alcohol close to bedtime, and stacking
            back-to-back high-load sessions with no easy day between them.
          </Text>
          <Text style={styles.disclaimer}>
            Coaching guidance only, not medical advice. Consult a healthcare provider for any health concerns.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "italic",
    color: Color.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  guidance: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  phaseNote: { fontSize: 12, color: Color.textMuted, lineHeight: 17, marginTop: 4 },
  loadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  loadLabel: { fontSize: 11, color: Color.textMuted, fontWeight: "600" },
  loadValue: { fontSize: 16, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  scoreHelp: { fontSize: 11, color: Color.textFaint, lineHeight: 15, marginTop: Spacing.sm },
  importLink: { alignSelf: "flex-end", paddingVertical: Spacing.xs, paddingHorizontal: 2 },
  importLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  formCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  formTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  cancelText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  submit: { marginTop: Spacing.sm },
  error: { fontSize: 12, color: Color.danger, marginBottom: Spacing.sm },
  saved: { fontSize: 12, color: Color.success, marginBottom: Spacing.sm },
  section: { marginBottom: Spacing.xl },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logCardActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  logDate: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  logMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  logScore: { fontSize: 18, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  referenceCard: { padding: Spacing.md, marginBottom: Spacing.md },
  referenceTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  referenceHeading: { fontSize: 12, fontWeight: "700", color: Color.textSecondary },
  referenceBody: { fontSize: 12, color: Color.textMuted, lineHeight: 17, marginTop: 2 },
  disclaimer: { fontSize: 10, color: Color.textFaint, lineHeight: 14, marginTop: Spacing.md, fontStyle: "italic" },
});
