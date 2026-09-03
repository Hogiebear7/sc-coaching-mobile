import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import type { ProgramDay } from "@/lib/queries/programs";

// Read-only rendering of one program day's exercises (or its rest-day
// state) — shared by the Workouts tab's ACTIVE PROGRAM card and the AI
// programme preview screen, so a day looks identical whether it's the one
// the member's about to start or one they're reviewing before saving.
// Actions (Start workout / Mark complete / Save) stay in each screen —
// this component only ever reads a day, never mutates anything.
export function ProgramDayCard({ day }: { day: ProgramDay }) {
  if (day.type === "rest") {
    return (
      <View style={styles.restRow}>
        <Ionicons name="moon-outline" size={18} color={Color.textMuted} />
        <Text style={styles.restText}>Rest day — no exercises prescribed.</Text>
      </View>
    );
  }

  return (
    <>
      {day.exercises.map((ex) => (
        <View key={ex.id} style={styles.exerciseRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {ex.supersetGroup ? (
              <View style={styles.supersetBadge}>
                <Text style={styles.supersetBadgeText}>{ex.supersetGroup}</Text>
              </View>
            ) : null}
            <Text style={styles.exerciseName}>{ex.name}</Text>
          </View>
          <Text style={styles.exerciseTarget}>
            {[
              ex.targetSets !== null && ex.targetReps
                ? `${ex.targetSets} × ${ex.targetReps}`
                : (ex.targetReps ?? (ex.targetSets !== null ? `${ex.targetSets} sets` : null)),
              ex.targetWeight,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </Text>
          {ex.muscleTags.length > 0 ? (
            <View style={styles.muscleTagRow}>
              {ex.muscleTags.map((tag) => (
                <View key={tag} style={styles.muscleTagChip}>
                  <Text style={styles.muscleTagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  restRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingVertical: Spacing.sm },
  restText: { fontSize: 13, color: Color.textMuted },
  exerciseRow: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  exerciseName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  exerciseTarget: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  supersetBadge: { borderRadius: 999, backgroundColor: Color.gold + "26", paddingHorizontal: 6, paddingVertical: 1 },
  supersetBadgeText: { fontSize: 10, fontWeight: "700", color: Color.gold },
  muscleTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: Spacing.xs },
  muscleTagChip: { borderRadius: Radius.pill, backgroundColor: Color.goldWeak, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  muscleTagChipText: { fontSize: 10, fontWeight: "600", color: Color.gold },
});
