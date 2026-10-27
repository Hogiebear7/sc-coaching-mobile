import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { MuscleThumb } from "@/components/ui/MuscleThumb";
import { muscleFocusFor } from "@/lib/exercise-muscles";
import type { ExerciseSection, WorkoutExerciseEntry, WorkoutRunEntry } from "@/lib/queries/workouts";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { exerciseSetSummary, formatRun } from "@/lib/workout-formatters";

// The exercise rows inside a workout card — shared by the History list,
// the Workouts tab and Community activity so a logged workout reads the
// same wherever it shows up: muscle icon, name, then one summary line
// ("4 sets · 15 kg × 20") instead of every set printed in faint grey.
export function ExercisePreviewList({
  exercises,
  runs = [],
  maxRows = 3,
  sectionByExerciseId,
}: {
  exercises: WorkoutExerciseEntry[];
  runs?: WorkoutRunEntry[];
  maxRows?: number;
  sectionByExerciseId?: Map<string, ExerciseSection>;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const shownExercises = exercises.slice(0, maxRows);
  const shownRuns = runs.slice(0, Math.max(0, maxRows - shownExercises.length));
  const hidden = exercises.length + runs.length - shownExercises.length - shownRuns.length;

  return (
    <View style={styles.list}>
      {shownExercises.map((ex, i) => {
        const section = ex.exerciseId ? sectionByExerciseId?.get(ex.exerciseId) : undefined;
        const focus = muscleFocusFor(ex.name, section);
        return (
          <View key={`ex-${i}`} style={styles.row}>
            <View style={styles.icon}>
              {focus ? <MuscleThumb focus={focus} size={44} /> : <Ionicons name="barbell-outline" size={16} color={Color.textMuted} />}
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {ex.name.trim() || "Exercise"}
              </Text>
              <Text style={styles.summary} numberOfLines={1}>
                {exerciseSetSummary(ex)}
              </Text>
            </View>
          </View>
        );
      })}
      {shownRuns.map((run, i) => (
        <View key={`run-${i}`} style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="walk-outline" size={16} color={Color.textMuted} />
          </View>
          <View style={styles.text}>
            <Text style={styles.name}>Run</Text>
            <Text style={styles.summary} numberOfLines={1}>
              {formatRun(run) || "Logged"}
            </Text>
          </View>
        </View>
      ))}
      {hidden > 0 ? (
        <Text style={styles.more}>
          +{hidden} more exercise{hidden === 1 ? "" : "s"}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    list: { gap: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Color.bg0, alignItems: "center", justifyContent: "center" },
    text: { flex: 1 },
    name: { fontSize: 15, fontWeight: "500", color: Color.textPrimary },
    summary: { fontSize: 14, color: Color.textMuted, marginTop: 1, fontVariant: ["tabular-nums"] },
    more: { fontSize: 14, fontWeight: "500", color: Color.textSecondary, marginTop: 2, marginLeft: 48 },
  })
);
