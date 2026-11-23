import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BodyPartPicker } from "@/components/workout/BodyPartPicker";
import { tapFeedback } from "@/lib/haptics";
import type { ExerciseSection } from "@/lib/queries/workouts";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Shown under the name of an exercise a coach typed into a class workout that is not in the library: "Save to the library", then which body part it is, so it
// autocompletes (with its muscle picture) next time. Hidden for names already in the library and while the field is empty.
export function SaveToLibraryPrompt({
  name,
  exerciseId,
  knownNames,
  saving,
  onSave,
}: {
  name: string;
  exerciseId: string | null;
  /** Every name already in the coach's library and the big imported one (compared ignoring case). */
  knownNames: string[];
  saving: boolean;
  onSave: (section: ExerciseSection) => Promise<boolean>;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [open, setOpen] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (savedName !== null && savedName === lower) {
    return <Text style={styles.done}>Saved to the library</Text>;
  }
  if (clean.length < 2 || exerciseId || knownNames.some((n) => n.trim().toLowerCase() === lower)) return null;

  if (!open) {
    return (
      <Pressable
        onPress={() => {
          tapFeedback();
          setError(null);
          setOpen(true);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Save ${clean} to the exercise library`}
        style={styles.link}
      >
        <Text style={[styles.linkText, { color: Color.gold }]}>Not in the library. Save “{clean}” for next time</Text>
      </Pressable>
    );
  }

  return (
    <View>
      {saving ? (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color={Color.textPrimary} />
          <Text style={styles.savingText}>Saving to the library…</Text>
        </View>
      ) : (
        <BodyPartPicker
          name={clean}
          section={null}
          remembered={false}
          onPick={async (section) => {
            if (!section) return;
            setError(null);
            try {
              const ok = await onSave(section);
              if (ok) {
                setSavedName(lower);
                setOpen(false);
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save it. Try again.");
            }
          }}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!saving ? (
        <Pressable onPress={() => setOpen(false)} hitSlop={6} accessibilityRole="button" style={styles.link}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    link: { marginTop: 8 },
    linkText: { fontSize: 13, fontWeight: "600" },
    done: { marginTop: 8, fontSize: 13, color: Color.textMuted },
    savingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    savingText: { fontSize: 13, color: Color.textMuted },
    error: { marginTop: 6, fontSize: 13, color: Color.danger ?? "#ff6b6b" },
    cancel: { fontSize: 13, color: Color.textMuted },
  })
);
