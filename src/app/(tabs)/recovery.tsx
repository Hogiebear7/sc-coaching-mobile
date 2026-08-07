import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReadinessRing } from "@/components/ui/ReadinessRing";
import { Stepper } from "@/components/ui/Stepper";
import { Color, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { useLogRecovery, useRecovery } from "@/lib/queries/recovery";

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function CheckInForm({ todayISO }: { todayISO: string }) {
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [soreness, setSoreness] = useState(5);
  const [fatigue, setFatigue] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const logRecovery = useLogRecovery();

  async function submit() {
    setError(null);
    try {
      const res = await logRecovery.mutateAsync({
        date: todayISO,
        sleepHours,
        sleepQuality,
        soreness,
        fatigue,
      });
      if (!res.success) setError(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <Card style={styles.formCard}>
      <Text style={styles.formTitle}>Today&apos;s check-in</Text>
      <Stepper label="Sleep hours" value={sleepHours} onChange={setSleepHours} min={0} max={12} step={0.5} suffix="h" />
      <Stepper label="Sleep quality (1-10)" value={sleepQuality} onChange={setSleepQuality} min={1} max={10} />
      <Stepper label="Soreness (1-10, higher = more sore)" value={soreness} onChange={setSoreness} min={1} max={10} />
      <Stepper label="Fatigue (1-5, higher = more tired)" value={fatigue} onChange={setFatigue} min={1} max={5} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save check-in" onPress={submit} loading={logRecovery.isPending} style={styles.submit} />
    </Card>
  );
}

export default function RecoveryScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useRecovery();

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
      >
        <Text style={styles.heading}>Recovery</Text>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <ReadinessRing score={data.latestReadinessScore} />
            <View style={{ flex: 1 }}>
              {data.latestGuidance ? (
                <Text style={styles.guidance}>{data.latestGuidance}</Text>
              ) : (
                <Text style={styles.guidance}>Log today&apos;s recovery to get a readiness score.</Text>
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
        </Card>

        {!data.hasLoggedToday && <CheckInForm todayISO={data.todayISO} />}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HISTORY</Text>
          {data.logs.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No check-ins logged yet.</Text>
            </Card>
          ) : (
            data.logs.slice(0, 14).map((log) => (
              <Card key={log.id} style={styles.logCard}>
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
  formCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  formTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.md },
  submit: { marginTop: Spacing.sm },
  error: { fontSize: 12, color: Color.danger, marginBottom: Spacing.sm },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
    marginBottom: Spacing.sm,
  },
  emptyCard: { alignItems: "center", padding: Spacing.xl },
  emptyText: { fontSize: 12, color: Color.textMuted },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logDate: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  logMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  logScore: { fontSize: 18, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
});
