import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useWorkouts } from "@/lib/queries/workouts";
import { getRecentRecords, groupRecordsByWeek, todayDateString } from "@/lib/workout-formatters";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

function formatShortDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// The full record history, broken into weekly sections — the Workouts tab
// only teases the 3 most recent so this is where a long PB history actually
// lives without turning into one endless scroll.
export default function WorkoutRecordsScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>All records</Text>
        <View style={{ width: 36 }} />
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
                    onPress={() => {
                      tapFeedback();
                      router.push({ pathname: "/exercise-detail", params: { name: r.exerciseName } });
                    }}
                    style={({ pressed }) => [styles.recordRow, idx > 0 && styles.recordRowDivider, pressed && { opacity: 0.8 }]}
                    accessibilityRole="button"
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

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    section: { marginBottom: Spacing.lg },
    weekLabel: { fontSize: 19, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.sm },
    recordsList: { padding: 0, overflow: "hidden" },
    recordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 62, paddingHorizontal: Spacing.md, paddingVertical: 10, gap: Spacing.sm },
    recordRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle },
    recordExercise: { fontSize: 16, fontWeight: "500", color: Color.textPrimary },
    recordLabel: { fontSize: 14, color: Color.textMuted, marginTop: 2 },
    recordValueWrap: { alignItems: "flex-end" },
    recordValue: { fontSize: 16, fontWeight: "600", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
    recordDate: { fontSize: 13, color: Color.textFaint, marginTop: 2 },
  })
);
