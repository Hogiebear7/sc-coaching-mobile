import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useExerciseLibrary } from "@/lib/queries/exercise-library";
import { generateWorkout } from "@/lib/workout-generator";

const TIME_PRESETS = [15, 30, 45, 60, 90];

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Pressable key={opt} onPress={() => onToggle(opt)} style={[styles.chip, selected.has(opt) && styles.chipActive]}>
          <Text style={[styles.chipText, selected.has(opt) && styles.chipTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function WorkoutGeneratorScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useExerciseLibrary();

  const [primaryBodyParts, setPrimaryBodyParts] = useState<Set<string>>(new Set());
  const [secondaryBodyParts, setSecondaryBodyParts] = useState<Set<string>>(new Set());
  const [equipment, setEquipment] = useState<Set<string>>(new Set());
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    if (!data || primaryBodyParts.size === 0) {
      setError("Pick at least one primary muscle area.");
      return;
    }
    setError(null);

    const exercises = generateWorkout({
      exercises: data.exercises,
      primaryBodyParts: [...primaryBodyParts],
      secondaryBodyParts: [...secondaryBodyParts],
      equipment: [...equipment],
      timeMinutes,
    });

    if (exercises.length === 0) {
      setError("No matching exercises for that combination — try a different muscle area or equipment.");
      return;
    }

    router.push({
      pathname: "/log-workout",
      params: {
        title: "Generated Workout",
        generatedExercises: JSON.stringify(exercises),
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Generate a Workout</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load the exercise library.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>PRIMARY MUSCLES</Text>
          <Text style={styles.sectionSub}>Most of the workout targets these.</Text>
          <ChipGroup
            options={data.filters.bodyParts}
            selected={primaryBodyParts}
            onToggle={(v) => setPrimaryBodyParts((prev) => toggleInSet(prev, v))}
          />

          <Text style={styles.sectionLabel}>SECONDARY MUSCLES — OPTIONAL</Text>
          <Text style={styles.sectionSub}>A smaller share of the workout targets these.</Text>
          <ChipGroup
            options={data.filters.bodyParts}
            selected={secondaryBodyParts}
            onToggle={(v) => setSecondaryBodyParts((prev) => toggleInSet(prev, v))}
          />

          <Text style={styles.sectionLabel}>TIME AVAILABLE</Text>
          <View style={styles.chipRow}>
            {TIME_PRESETS.map((mins) => (
              <Pressable
                key={mins}
                onPress={() => setTimeMinutes(mins)}
                style={[styles.chip, timeMinutes === mins && styles.chipActive]}
              >
                <Text style={[styles.chipText, timeMinutes === mins && styles.chipTextActive]}>{mins} min</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>EQUIPMENT AVAILABLE — OPTIONAL</Text>
          <Text style={styles.sectionSub}>Leave blank to allow any equipment.</Text>
          <ChipGroup
            options={data.filters.equipment}
            selected={equipment}
            onToggle={(v) => setEquipment((prev) => toggleInSet(prev, v))}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Generate workout" onPress={handleGenerate} style={{ marginTop: Spacing.lg }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.lg },
  sectionSub: { fontSize: 12, color: Color.textFaint, marginTop: 2, marginBottom: Spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted, textTransform: "capitalize" },
  chipTextActive: { color: Color.gold },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
});
