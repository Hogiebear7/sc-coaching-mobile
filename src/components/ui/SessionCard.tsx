import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import type { WorkoutSessionSummary } from "@/lib/queries/workouts";
import { formatExerciseLoad, formatRun } from "@/lib/workout-formatters";

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// Shared compact session summary — used on the Workouts tab (day detail +
// recent list) and the full History screen so the three don't drift.
export function SessionCard({ session, showDate = true }: { session: WorkoutSessionSummary; showDate?: boolean }) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{session.title}</Text>
        {showDate ? <Text style={styles.date}>{formatDate(session.date)}</Text> : null}
      </View>
      <Text style={styles.meta}>
        {session.exercises.length} exercise{session.exercises.length === 1 ? "" : "s"}
        {session.durationMins ? ` · ${session.durationMins} min` : ""}
      </Text>
      {session.exercises.map((ex, i) => (
        <Text key={i} style={styles.line} numberOfLines={1}>
          {ex.name}
          {formatExerciseLoad(ex) ? ` — ${formatExerciseLoad(ex)}` : ""}
        </Text>
      ))}
      {session.runs.map((run, i) => (
        <Text key={i} style={styles.line} numberOfLines={1}>
          Run — {formatRun(run)}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  date: { fontSize: 11, color: Color.textMuted },
  meta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  line: { fontSize: 11, color: Color.textFaint, marginTop: 4 },
});
