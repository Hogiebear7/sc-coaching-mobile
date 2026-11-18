import { Pressable, StyleSheet, Text, View } from "react-native";

import { MuscleThumb } from "@/components/ui/MuscleThumb";
import { BODY_PART_CHOICES, muscleFocusFor } from "@/lib/exercise-muscles";
import type { ExerciseSection } from "@/lib/queries/workouts";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Shown under the name of an exercise that is not in the library (one the member typed themselves): "Which body part is this?", then the same muscle picture every
// other exercise gets. Picking one is optional; leaving it blank just means no picture. Inline chips, not a pop-up, so it never competes with other screens opening.
export function BodyPartPicker({
  name,
  section,
  remembered,
  onPick,
}: {
  name: string;
  section: ExerciseSection | null;
  /** True when the choice came from an earlier workout (so the member did not have to pick again). */
  remembered: boolean;
  onPick: (section: ExerciseSection | null) => void;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const focus = section ? muscleFocusFor(name, null, section) : null;
  const label = section ? BODY_PART_CHOICES.find((c) => c.section === section)?.label : null;

  if (section && focus) {
    return (
      <View style={styles.chosenRow}>
        <MuscleThumb focus={focus} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.chosenLabel}>{label}</Text>
          <Text style={styles.chosenHint}>{remembered ? "Remembered from before" : "Shown with this exercise"}</Text>
        </View>
        <Pressable onPress={() => onPick(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change the body part">
          <Text style={[styles.change, { color: Color.gold }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.question}>Which body part is this?</Text>
      <View style={styles.chips}>
        {BODY_PART_CHOICES.map((c) => (
          <Pressable key={c.section} onPress={() => onPick(c.section)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`${c.label}`}>
            <Text style={styles.chipText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    wrap: { marginTop: 10, gap: 8 },
    question: { fontSize: 13, fontWeight: "600", color: Color.textSecondary },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Color.surface2 },
    chipText: { fontSize: 13, fontWeight: "500", color: Color.textPrimary },
    chosenRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
    chosenLabel: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    chosenHint: { fontSize: 12, color: Color.textMuted, marginTop: 1 },
    change: { fontSize: 13, fontWeight: "600" },
  })
);
