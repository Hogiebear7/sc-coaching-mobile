import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/lib/queries/workouts";

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function WorkoutsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useWorkouts();

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
        <Text style={styles.heading}>Workouts</Text>

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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SESSION HISTORY</Text>
          {data.sessions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={22} color={Color.textFaint} />
              <Text style={styles.emptyText}>No workouts logged yet.</Text>
            </Card>
          ) : (
            data.sessions.map((s) => (
              <Card key={s.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTitle}>{s.title}</Text>
                  <Text style={styles.sessionDate}>{formatDate(s.date)}</Text>
                </View>
                <Text style={styles.sessionMeta}>
                  {s.exerciseCount} exercise{s.exerciseCount === 1 ? "" : "s"}
                  {s.durationMins ? ` · ${s.durationMins} min` : ""}
                </Text>
                {s.exerciseNames.length > 0 ? (
                  <Text style={styles.sessionExercises} numberOfLines={2}>
                    {s.exerciseNames.join(", ")}
                  </Text>
                ) : null}
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
  sessionCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sessionTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  sessionDate: { fontSize: 11, color: Color.textMuted },
  sessionMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  sessionExercises: { fontSize: 11, color: Color.textFaint, marginTop: 4 },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 12, color: Color.textMuted },
});
