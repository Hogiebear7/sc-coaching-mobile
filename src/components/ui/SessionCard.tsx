import { Pressable, StyleSheet, Text, View } from "react-native";

import { ExercisePreviewList } from "@/components/ui/ExercisePreviewList";
import { Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import type { ExerciseSection, WorkoutSessionSummary } from "@/lib/queries/workouts";
import { makeLegacyStyles } from "@/lib/theme";
import { computeSessionTotals } from "@/lib/workout-formatters";

function formatDate(dateISO: string): string {
  return new Date(`${dateISO.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

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
  const styles = useStyles();
  const totals = computeSessionTotals(session.exercises);
  const stats = [
    session.durationMins ? `${session.durationMins} min` : null,
    `${session.exercises.length} exercise${session.exercises.length === 1 ? "" : "s"}`,
    totals.totalVolume > 0 ? `${totals.totalVolume.toLocaleString()} kg` : null,
  ].filter(Boolean) as string[];

  const content = (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {session.title}
        </Text>
        {showDate ? <Text style={styles.date}>{formatDate(session.date)}</Text> : null}
      </View>
      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s} style={styles.statPill}>
            <Text style={styles.statText}>{s}</Text>
          </View>
        ))}
      </View>
      {session.exercises.length + session.runs.length > 0 ? (
        <View style={styles.body}>
          <ExercisePreviewList exercises={session.exercises} runs={session.runs} sectionByExerciseId={sectionByExerciseId} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${formatDate(session.date)}, ${stats.join(", ")}`}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: Spacing.sm },
    title: { flexShrink: 1, fontSize: 17, fontWeight: "600", color: Color.textPrimary },
    date: { fontSize: 14, color: Color.textMuted },
    stats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    statPill: { borderRadius: Radius.pill, backgroundColor: Color.surface2, paddingHorizontal: 10, paddingVertical: 4 },
    statText: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, fontVariant: ["tabular-nums"] },
    body: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle },
    pressed: { opacity: 0.85 },
  })
);
