import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Color, Spacing } from "@/constants/theme";
import { useWorkoutReview } from "@/lib/queries/workouts";

function deltaLabel(current: number | null, recentAvg: number | null, unit: string): string | null {
  if (current === null || recentAvg === null || recentAvg === 0) return null;
  const diffPct = Math.round(((current - recentAvg) / recentAvg) * 100);
  if (diffPct === 0) return `same as your recent average`;
  return `${diffPct > 0 ? "+" : ""}${diffPct}% vs. your recent average${unit ? ` ${unit}` : ""}`;
}

export default function WorkoutReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading, isError } = useWorkoutReview(id ?? null);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Session Review</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={Color.gold} />
          <Text style={styles.loadingText}>Putting your review together…</Text>
        </View>
      ) : isError || !data ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>Couldn&apos;t load your review right now.</Text>
          <Button title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.lg }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>YOUR REVIEW</Text>
            <Text style={styles.reviewText}>{data.reviewText}</Text>
          </Card>

          <Text style={styles.sectionLabel}>THIS SESSION VS. RECENT</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                label="RPE"
                value={data.comparison.thisRpe != null ? String(data.comparison.thisRpe) : "—"}
                subtext={deltaRpeLabel(data.comparison.thisRpe, data.comparison.recentAvgRpe) ?? undefined}
              />
              <StatCard
                label="Volume"
                value={data.comparison.thisVolume > 0 ? `${data.comparison.thisVolume.toLocaleString()} kg` : "—"}
                subtext={deltaLabel(data.comparison.thisVolume, data.comparison.recentAvgVolume, "") ?? undefined}
              />
            </View>
            {data.comparison.comparedSessionCount === 0 ? (
              <Text style={styles.noCompareText}>
                No previous session with this same title yet — comparisons will show up once you log a few more.
              </Text>
            ) : null}
          </View>

          {data.recovery ? (
            <>
              <Text style={styles.sectionLabel}>RECOVERY THAT DAY</Text>
              <Card style={styles.detailCard}>
                <DetailRow label="Sleep" value={data.recovery.sleepHours != null ? `${data.recovery.sleepHours} hrs` : "—"} />
                <DetailRow label="Sleep quality" value={data.recovery.sleepQuality != null ? `${data.recovery.sleepQuality}/10` : "—"} />
                <DetailRow label="Soreness" value={data.recovery.soreness != null ? `${data.recovery.soreness}/10` : "—"} />
                <DetailRow label="Readiness" value={data.recovery.readinessScore != null ? `${data.recovery.readinessScore}` : "—"} last />
              </Card>
            </>
          ) : null}

          {data.cyclePhase ? (
            <>
              <Text style={styles.sectionLabel}>CYCLE PHASE THAT DAY</Text>
              <Card style={styles.detailCard}>
                <DetailRow label="Phase" value={data.cyclePhase.phaseLabel} />
                <DetailRow
                  label="Cycle day"
                  value={data.cyclePhase.cycleDay != null ? `Day ${data.cyclePhase.cycleDay} of ~${data.cyclePhase.cycleLength}` : "—"}
                  last
                />
              </Card>
            </>
          ) : null}

          {data.nutrition ? (
            <>
              <Text style={styles.sectionLabel}>FUELING THAT DAY</Text>
              <Card style={styles.detailCard}>
                {data.nutrition.logged ? (
                  <>
                    <DetailRow
                      label="Calories"
                      value={`${data.nutrition.actualCalories ?? "—"} / ${data.nutrition.targetCalories ?? "—"} kcal`}
                    />
                    <DetailRow
                      label="Protein"
                      value={`${data.nutrition.actualProteinG ?? "—"} / ${data.nutrition.targetProteinG ?? "—"} g`}
                      last
                    />
                  </>
                ) : (
                  <DetailRow label="Logged" value="Nothing logged this day" last />
                )}
              </Card>
            </>
          ) : null}

          {data.hydration && data.hydration.targetMl !== null ? (
            <>
              <Text style={styles.sectionLabel}>HYDRATION THAT DAY</Text>
              <Card style={styles.detailCard}>
                <DetailRow
                  label="Water"
                  value={`${(data.hydration.loggedMl / 1000).toFixed(1)}L / ${(data.hydration.targetMl / 1000).toFixed(1)}L`}
                  last
                />
              </Card>
            </>
          ) : null}

          <Button title="Done" onPress={() => router.replace("/workouts")} style={{ marginTop: Spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function deltaRpeLabel(current: number | null, recentAvg: number | null): string | null {
  if (current === null || recentAvg === null) return null;
  const diff = Math.round((current - recentAvg) * 10) / 10;
  if (diff === 0) return "same as your recent average";
  return `${diff > 0 ? "+" : ""}${diff} vs. your recent average`;
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowDivider]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  loadingText: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.md },
  errorText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  reviewCard: { borderColor: Color.goldBorder, backgroundColor: Color.goldWeak },
  reviewLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.gold },
  reviewText: { fontSize: 14, color: Color.textPrimary, lineHeight: 20, marginTop: Spacing.xs },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  statsGrid: { gap: Spacing.sm },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  noCompareText: { fontSize: 12, color: Color.textFaint, marginTop: Spacing.xs, lineHeight: 17 },
  detailCard: { padding: 0, overflow: "hidden" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md },
  detailRowDivider: { borderBottomWidth: 1, borderBottomColor: Color.borderSubtle },
  detailLabel: { fontSize: 13, color: Color.textMuted },
  detailValue: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
});
