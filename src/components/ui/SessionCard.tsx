import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { MuscleMap } from "@/components/ui/MuscleMap";
import { Color, Spacing } from "@/constants/theme";
import type { ExerciseSection, WorkoutSessionSummary } from "@/lib/queries/workouts";
import { formatExerciseLoad, formatRun } from "@/lib/workout-formatters";

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// A session with 8+ exercises used to print 8+ faint grey lines — useful
// for exhaustiveness, useless for scanning. Cap the preview and roll the
// rest into one "+N more" line; the full list is one tap away via onPress.
const MAX_PREVIEW_LINES = 3;

// Shared compact session summary — used on the Workouts tab (day detail +
// recent list) and the full History screen so the three don't drift.
// Optional onPress makes the whole card a drill-down into session-detail;
// omit it for read-only contexts.
export function SessionCard({
  session,
  showDate = true,
  onPress,
  sectionByExerciseId,
}: {
  session: WorkoutSessionSummary;
  showDate?: boolean;
  onPress?: () => void;
  /** Exercise -> muscle-group lookup (from useWorkouts().exerciseLibrary) —
      optional so callers that don't have it handy still render fine, just
      without the muscle-map icon per line. */
  sectionByExerciseId?: Map<string, ExerciseSection>;
}) {
  const previewExercises = session.exercises.slice(0, MAX_PREVIEW_LINES);
  const remainingSlots = Math.max(0, MAX_PREVIEW_LINES - previewExercises.length);
  const previewRuns = session.runs.slice(0, remainingSlots);
  const hiddenCount = session.exercises.length + session.runs.length - previewExercises.length - previewRuns.length;

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
      {previewExercises.map((ex, i) => {
        const section = ex.exerciseId ? sectionByExerciseId?.get(ex.exerciseId) : undefined;
        return (
          <View key={i} style={styles.lineRow}>
            {section ? <MuscleMap section={section} size={12} /> : null}
            <Text style={styles.line} numberOfLines={1}>
              {ex.name}
              {formatExerciseLoad(ex) ? ` — ${formatExerciseLoad(ex)}` : ""}
            </Text>
          </View>
        );
      })}
      {previewRuns.map((run, i) => (
        <Text key={i} style={styles.line} numberOfLines={1}>
          Run — {formatRun(run)}
        </Text>
      ))}
      {hiddenCount > 0 ? <Text style={styles.moreLine}>+{hiddenCount} more</Text> : null}
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
  lineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  line: { flex: 1, fontSize: 11, color: Color.textFaint },
  moreLine: { fontSize: 11, color: Color.textMuted, fontWeight: "600", marginTop: 4 },
  pressed: { opacity: 0.7 },
});
