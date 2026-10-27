import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SectionTitle } from "@/components/app/primitives";
import { Button } from "@/components/ui/Button";
import { WatchDataCard } from "@/components/workout/WatchDataCard";
import { UpsellCard } from "@/components/ui/Upsell";
import { AppRadius, AppSpace, appTitle } from "@/constants/theme";
import { celebrateFeedback } from "@/lib/haptics";
import { hasAccess } from "@/lib/member-access";
import { useMemberTier } from "@/lib/queries/profile";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { notInPlanCopy } from "@/lib/upsell-config";
import { takePendingWorkoutSummary } from "@/lib/workout-summary-handoff";

// Built entirely from the payload the logging screen just submitted, plus
// the personalBests it already had in memory — no server round-trip, no
// new API. See log-workout.tsx's handleSubmit for how this is computed.
export interface WorkoutSummaryData {
  id: string;
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
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();
  const router = useRouter();
  const tier = useMemberTier();
  // Lazy initializer so this read-once handoff is only taken on the first
  // render of this screen instance, not on every re-render.
  const [summary] = useState<WorkoutSummaryData | null>(() => takePendingWorkoutSummary());
  const pbs = summary ? summary.exercises.filter((ex) => ex.isPb) : [];

  // The logger already gave a success buzz on save; only a PB earns a
  // second, heavier one here.
  useEffect(() => {
    if (summary && pbs.length > 0) celebrateFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!summary) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Workout logged.</Text>
          <Button title="Done" onPress={() => router.replace("/workouts")} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="checkmark" size={34} color={colors.onPrimary} />
          </View>
          <Text style={appTitle(32, colors.text)}>Workout complete</Text>
          <Text style={styles.heroSubtitle}>
            {summary.title || "Workout"} · {summary.date}
          </Text>
        </View>

        {pbs.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={pbs.length === 1 ? "New personal best" : `${pbs.length} new personal bests`} />
            <View style={styles.pbGrid}>
              {pbs.map((ex, i) => (
                <View key={`${ex.name}-${i}`} style={styles.pbCard} accessible accessibilityLabel={`New personal best: ${ex.name}, ${ex.summary}`}>
                  <View style={styles.pbHead}>
                    <Ionicons name="trophy" size={22} color={colors.brand} />
                    <Text style={styles.pbNew}>New</Text>
                  </View>
                  <Text style={styles.pbName} numberOfLines={2}>
                    {ex.name}
                  </Text>
                  <Text style={styles.pbDetail} numberOfLines={2}>
                    {ex.summary || "Personal best"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle title="Session" />
          <View style={styles.statGrid}>
            <Stat label="Duration" value={summary.durationLabel} color={dc.sessions} />
            <Stat label="Volume" value={summary.totalVolume > 0 ? `${summary.totalVolume.toLocaleString()} kg` : "—"} color={dc.weight} />
            <Stat label="Sets" value={`${summary.completedSets}/${summary.totalSets}`} color={dc.load} />
            <Stat label="Exercises" value={`${summary.completedExercises}/${summary.totalExercises}`} color={dc.readinessHigh} />
          </View>
        </View>

        {summary.exercises.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="Exercises" />
            <View style={styles.list}>
              {summary.exercises.map((ex, idx) => (
                <View key={`${ex.name}-${idx}`} style={[styles.row, idx > 0 && styles.rowDivider]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.rowTitle}>{ex.name}</Text>
                      {ex.isPb ? (
                        <View style={styles.pbTag}>
                          <Text style={styles.pbTagText}>PB</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowSub}>{ex.summary || "—"}</Text>
                  </View>
                  <Text style={styles.rowValue}>
                    {ex.setsCompleted}/{ex.setsLogged}
                    <Text style={styles.rowUnit}> sets</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <WatchDataCard sessionId={summary.id} />

        {hasAccess(tier, "workoutReview") ? (
          <Button title="View your session review" onPress={() => router.push({ pathname: "/workout-review", params: { id: summary.id } })} />
        ) : (
          <UpsellCard icon="analytics-outline" title="Session review" body={notInPlanCopy("Session review")} />
        )}
        <Button title="Done" variant="secondary" onPress={() => router.replace("/workouts")} style={{ marginTop: 10 }} />
        <Button title="View full history" variant="secondary" onPress={() => router.push("/workout-history")} style={{ marginTop: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingBottom: 48 },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { fontSize: 17, color: c.textSecondary },
    hero: { alignItems: "center", paddingTop: 32, paddingBottom: 24 },
    heroBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.success,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    heroSubtitle: { fontSize: 16, color: c.textSecondary, marginTop: 6, textAlign: "center" },
    section: { marginBottom: AppSpace.section },
    pbGrid: { flexDirection: "row", flexWrap: "wrap", gap: AppSpace.gap },
    pbCard: {
      width: "48.6%",
      backgroundColor: c.surface,
      borderRadius: AppRadius.card,
      borderWidth: 1.5,
      borderColor: c.brand,
      padding: 14,
      minHeight: 128,
    },
    pbHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    pbNew: { fontSize: 13, fontWeight: "700", color: c.brand },
    pbName: { fontSize: 16, fontWeight: "600", color: c.text },
    pbDetail: { fontSize: 14, color: c.textSecondary, marginTop: 4 },
    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: AppSpace.gap },
    stat: { width: "48.6%", backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 14 },
    statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 10 },
    statValue: { fontSize: 24, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"] },
    statLabel: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    list: { backgroundColor: c.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowTitle: { fontSize: 16, color: c.text, flexShrink: 1 },
    rowSub: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    rowValue: { fontSize: 16, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    rowUnit: { fontSize: 13, fontWeight: "400", color: c.textMuted },
    pbTag: { borderRadius: 6, backgroundColor: c.brand, paddingHorizontal: 6, paddingVertical: 1 },
    pbTagText: { fontSize: 12, fontWeight: "700", color: "#0a1526" },
  })
);
