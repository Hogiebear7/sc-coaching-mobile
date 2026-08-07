import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import type { ExerciseLibraryEntry } from "@/lib/queries/workouts";

const SECTION_LABELS: Record<string, string> = {
  upper_push: "Upper — Push",
  upper_pull: "Upper — Pull",
  lower_push: "Lower — Push",
  lower_pull: "Lower — Pull",
  core: "Core",
  cardio: "Cardio",
};

// RN port of the web app's ExerciseAutocomplete.tsx — same filter behavior
// (substring match, capped to 8 suggestions), touch-friendly list instead
// of a hover/keyboard-nav combobox.
export function ExerciseAutocomplete({
  exercises,
  value,
  onChange,
}: {
  exercises: ExerciseLibraryEntry[];
  value: string;
  onChange: (name: string, exerciseId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const suggestions =
    value.trim().length > 0
      ? exercises.filter((e) => e.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
      : [];

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(text) => {
          onChange(text, null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Bench Press"
        placeholderTextColor={Color.textFaint}
        style={styles.input}
      />
      {open && suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                onChange(s.name, s.id);
                setOpen(false);
              }}
              style={styles.suggestionRow}
            >
              <Text style={styles.suggestionName}>{s.name}</Text>
              <Text style={styles.suggestionSection}>{SECTION_LABELS[s.section] ?? s.section}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Color.textPrimary,
  },
  suggestions: {
    marginTop: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  suggestionName: { fontSize: 13, fontWeight: "500", color: Color.textPrimary },
  suggestionSection: { fontSize: 10, color: Color.textMuted },
});
