import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/lib/queries/workouts";
import { getRecentRecords, groupRecordsByWeek, todayDateString } from "@/lib/workout-formatters";

function formatShortDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// The full record history, broken into weekly sections — the Workouts tab
// only teases the 3 most recent so this is where a long PB history actually
// lives without turning into one endless scroll.
export default function WorkoutRecordsScreen() {
  const router = useRouter();
  const { data, isLoading } = useWorkouts();
  const today = todayDateString();

  const weeks = useMemo(() => {
    if (!data) return [];
    return groupRecordsByWeek(getRecentRecords(data.sessions, 3650, today));
  }, [data, today]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>All Records</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : weeks.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No records yet — log a workout to start setting them.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {weeks.map((week) => (
            <View key={week.weekStartISO} style={styles.section}>
              <Text style={styles.weekLabel}>{week.label}</Text>
              <Card style={styles.recordsList}>
                {week.records.map((r, idx) => (
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
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
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
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.lg },
  weekLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  recordsList: { padding: 0, overflow: "hidden" },
  recordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
  recordRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  recordExercise: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  recordLabel: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  recordValueWrap: { alignItems: "flex-end" },
  recordValue: { fontSize: 14, fontWeight: "700", color: Color.gold },
  recordDate: { fontSize: 11, color: Color.textFaint, marginTop: 2 },
});
