import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import type { WorkoutSessionSummary } from "@/lib/queries/workouts";
import { formatExerciseLoad, formatRun } from "@/lib/workout-formatters";

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// Shared compact session summary — used on the Workouts tab (day detail +
// recent list) and the full History screen so the three don't drift.
// Optional onPress makes the whole card a drill-down into session-detail;
// omit it for read-only contexts.
export function SessionCard({
  session,
  showDate = true,
  onPress,
}: {
  session: WorkoutSessionSummary;
  showDate?: boolean;
  onPress?: () => void;
}) {
  const content = (
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

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  date: { fontSize: 11, color: Color.textMuted },
  meta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  line: { fontSize: 11, color: Color.textFaint, marginTop: 4 },
  pressed: { opacity: 0.7 },
});
