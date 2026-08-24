import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import type { ExerciseLibraryEntry } from "@/lib/queries/workouts";

export const SECTION_LABELS: Record<string, string> = {
  upper_push: "Upper — Push",
  upper_pull: "Upper — Pull",
  lower_push: "Lower — Push",
  lower_pull: "Lower — Pull",
  core: "Core",
  cardio: "Cardio",
};

// Name+slug pair from useExerciseLibraryNameIndex() — the big imported
// library (hundreds of exercises with GIFs/instructions), distinct from the
// small coach-curated `exercises` list below.
export interface ExerciseLibraryNameEntry {
  name: string;
  slug: string;
}

interface Suggestion {
  key: string;
  name: string;
  exerciseId: string | null;
  badge: string;
}

// RN port of the web app's ExerciseAutocomplete.tsx — same filter behavior
// (substring match, capped to 8 suggestions), touch-friendly list instead
// of a hover/keyboard-nav combobox.
//
// Suggestions merge two sources: the coach-curated `exercises` list (small,
// carries a muscle-group `section` so it feeds Set Levels tracking) and the
// big imported `libraryNames` list (hundreds of exercises with demo GIFs,
// no muscle-group section). Curated matches are shown first and take
// priority on a name collision, since only they carry set-level tracking;
// picking a library-only suggestion still saves fine — it just isn't
// muscle-group tracked — and its GIF/demo still resolves afterwards via the
// existing name-based lookup (findExerciseLibrarySlug).
export function ExerciseAutocomplete({
  exercises,
  libraryNames = [],
  value,
  onChange,
}: {
  exercises: ExerciseLibraryEntry[];
  libraryNames?: ExerciseLibraryNameEntry[];
  value: string;
  onChange: (name: string, exerciseId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const query = value.trim().toLowerCase();
  let suggestions: Suggestion[] = [];
  if (query) {
    const curatedMatches: Suggestion[] = exercises
      .filter((e) => e.name.toLowerCase().includes(query))
      .map((e) => ({ key: e.id, name: e.name, exerciseId: e.id, badge: SECTION_LABELS[e.section] ?? e.section }));
    const curatedNames = new Set(exercises.map((e) => e.name.toLowerCase()));
    const seenLibraryNames = new Set<string>();
    const libraryMatches: Suggestion[] = [];
    for (const l of libraryNames) {
      const lower = l.name.toLowerCase();
      if (!lower.includes(query) || curatedNames.has(lower) || seenLibraryNames.has(lower)) continue;
      seenLibraryNames.add(lower);
      libraryMatches.push({ key: `lib:${l.slug}`, name: l.name, exerciseId: null, badge: "Library" });
    }
    suggestions = [...curatedMatches, ...libraryMatches].slice(0, 8);
  }

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
              key={s.key}
              onPress={() => {
                onChange(s.name, s.exerciseId);
                setOpen(false);
              }}
              style={styles.suggestionRow}
            >
              <Text style={styles.suggestionName}>{s.name}</Text>
              <Text style={styles.suggestionSection}>{s.badge}</Text>
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
