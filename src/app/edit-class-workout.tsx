import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { SupersetChips } from "@/components/ui/SupersetChips";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { ApiError } from "@/lib/api-client";
import {
  useUpdateClassWorkout,
  useWorkouts,
  type CreateWorkoutExerciseInput,
  type WorkoutSetType,
} from "@/lib/queries/workouts";
import { formatAsKg } from "@/lib/workout-formatters";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `edit-class-${Date.now()}-${keySeq}`;
}

type EditExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  weight: string;
  reps: string;
  sets: string;
  rir: string;
  notes: string;
  setDetails: CreateWorkoutExerciseInput["setDetails"];
  setType: WorkoutSetType | null;
  supersetGroup: string | null;
  perSide: boolean;
};

function newExerciseRow(): EditExerciseRow {
  return {
    key: nextKey(),
    exerciseId: null,
    name: "",
    weight: "",
    reps: "",
    sets: "",
    rir: "",
    notes: "",
    setDetails: [],
    setType: null,
    supersetGroup: null,
    perSide: false,
  };
}

// Correcting a class-synced workout: only exercises + notes are editable —
// the title/date/duration come from the class itself, and there's no run
// tracking here (see /api/workouts/update's contract). Coaches often don't
// get around to filling in everyone's weights, so this has no time limit —
// members can fix their own numbers whenever they notice.
export default function EditClassWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useWorkouts();
  const updateClassWorkout = useUpdateClassWorkout();

  const session = useMemo(() => data?.sessions.find((s) => s.id === id), [data, id]);

  const [notes, setNotes] = useState("");
  const [exerciseRows, setExerciseRows] = useState<EditExerciseRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && !hydrated) {
    setNotes(session.notes ?? "");
    setExerciseRows(
      session.exercises.map((ex) => ({
        key: nextKey(),
        exerciseId: ex.exerciseId,
        name: ex.name,
        weight: ex.weight ?? "",
        reps: ex.reps != null ? String(ex.reps) : "",
        sets: ex.sets != null ? String(ex.sets) : "",
        rir: ex.rir != null ? String(ex.rir) : "",
        notes: ex.notes ?? "",
        setDetails: ex.setDetails ?? [],
        setType: ex.setType ?? null,
        supersetGroup: ex.supersetGroup ?? null,
        perSide: ex.perSide ?? false,
      }))
    );
    setHydrated(true);
  }

  function updateRow(key: string, patch: Partial<Omit<EditExerciseRow, "key">>) {
    setExerciseRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    Alert.alert("Remove this exercise?", "Any details you've entered for it will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          setExerciseRows((prev) => prev.filter((r) => r.key !== key));
        },
      },
    ]);
  }

  async function handleSave() {
    if (!session) return;
    setError(null);

    const exercises: CreateWorkoutExerciseInput[] = exerciseRows
      .filter((row) => row.name.trim())
      .map((row) => ({
        exerciseId: row.exerciseId,
        name: row.name.trim(),
        weight: row.weight.trim() || null,
        reps: row.reps.trim() ? parseInt(row.reps, 10) : null,
        sets: row.sets.trim() ? parseInt(row.sets, 10) : null,
        rir: row.rir.trim() ? parseInt(row.rir, 10) : null,
        setDetails: row.setDetails ?? [],
        setType: row.setType,
        supersetGroup: row.supersetGroup,
        perSide: row.perSide,
        notes: row.notes.trim() || null,
      }));

    if (exercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }

    try {
      await updateClassWorkout.mutateAsync({ sessionId: session.id, exercises, notes: notes.trim() });
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Correct Class Workout</Text>
          <View style={{ width: 22 }} />
        </View>

        {isLoading ? (
          <View style={styles.centerFill}>
            <Text style={styles.emptyText}>Loading…</Text>
          </View>
        ) : !session ? (
          <View style={styles.centerFill}>
            <Text style={styles.emptyText}>Couldn&apos;t find that session.</Text>
            <Button title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.subhead}>
              {session.title} — {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </Text>
            <Text style={styles.hint}>
              Fix your own weights, reps, or sets if your coach hasn&apos;t gotten to it yet.
            </Text>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>EXERCISES</Text>
              <Pressable onPress={() => setExerciseRows((prev) => [...prev, newExerciseRow()])} style={styles.addChip}>
                <Text style={styles.addChipText}>+ Exercise</Text>
              </Pressable>
            </View>

            {exerciseRows.length === 0 ? (
              <Text style={styles.emptyHint}>No exercises yet. Use the button above to add one.</Text>
            ) : null}

            {exerciseRows.map((row, idx) => (
              <Card key={row.key} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryLabel}>Exercise {idx + 1}</Text>
                  <Pressable onPress={() => removeRow(row.key)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>Superset (opt.)</Text>
                <SupersetChips
                  value={row.supersetGroup}
                  allGroups={exerciseRows.map((r) => r.supersetGroup)}
                  onChange={(v) => updateRow(row.key, { supersetGroup: v })}
                />

                <Text style={styles.fieldLabel}>Exercise name</Text>
                <ExerciseAutocomplete
                  exercises={data?.exerciseLibrary ?? []}
                  value={row.name}
                  onChange={(name, exerciseId) => updateRow(row.key, { name, exerciseId })}
                />

                <View style={styles.gridRow}>
                  <TextField
                    label="Weight"
                    value={row.weight}
                    onChangeText={(v) => updateRow(row.key, { weight: v })}
                    onBlur={() => {
                      const formatted = formatAsKg(row.weight);
                      if (formatted !== row.weight) updateRow(row.key, { weight: formatted });
                    }}
                    placeholder="e.g. 60"
                    style={styles.gridInput}
                  />
                  <TextField
                    label="Reps"
                    value={row.reps}
                    onChangeText={(v) => updateRow(row.key, { reps: v })}
                    keyboardType="number-pad"
                    placeholder="e.g. 8"
                    style={styles.gridInput}
                  />
                </View>
                <View style={styles.gridRow}>
                  <TextField
                    label="Sets"
                    value={row.sets}
                    onChangeText={(v) => updateRow(row.key, { sets: v })}
                    keyboardType="number-pad"
                    placeholder="e.g. 3"
                    style={styles.gridInput}
                  />
                  <TextField
                    label="RIR (opt.)"
                    value={row.rir}
                    onChangeText={(v) => updateRow(row.key, { rir: v })}
                    keyboardType="number-pad"
                    placeholder="e.g. 2"
                    style={styles.gridInput}
                  />
                </View>

                <Pressable onPress={() => updateRow(row.key, { perSide: !row.perSide })} style={styles.perSideRow}>
                  <Ionicons
                    name={row.perSide ? "checkbox" : "square-outline"}
                    size={16}
                    color={row.perSide ? Color.gold : Color.textFaint}
                  />
                  <Text style={[styles.perSideText, row.perSide && styles.perSideTextActive]}>
                    Reps are per arm/leg (unilateral)
                  </Text>
                </Pressable>

                <TextField
                  label="Notes (optional)"
                  value={row.notes}
                  onChangeText={(v) => updateRow(row.key, { notes: v })}
                  placeholder="e.g. Felt strong, could go heavier"
                />
              </Card>
            ))}

            <TextField
              label="Session notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="How did the class feel overall?"
              multiline
              style={styles.multiline}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actionsRow}>
              <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
              <Button
                title="Save changes"
                onPress={handleSave}
                loading={updateClassWorkout.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
  emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  subhead: { fontSize: 14, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.sm },
  hint: { fontSize: 12, color: Color.textMuted, marginTop: 4, lineHeight: 17 },
  multiline: { minHeight: 80, textAlignVertical: "top", paddingTop: Spacing.sm, marginTop: Spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.lg, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  addChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  addChipText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  emptyHint: { fontSize: 13, color: Color.textFaint, paddingVertical: Spacing.md },
  entryCard: { padding: Spacing.md, marginBottom: Spacing.md },
  entryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  entryLabel: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  removeText: { fontSize: 13, fontWeight: "600", color: Color.danger },
  fieldLabel: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  gridRow: { flexDirection: "row", gap: Spacing.sm },
  gridInput: { flex: 1 },
  perSideRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.sm },
  perSideText: { fontSize: 12, fontWeight: "500", color: Color.textMuted },
  perSideTextActive: { color: Color.textPrimary },
  error: { fontSize: 13, color: Color.danger, marginTop: Spacing.sm },
  actionsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
});
