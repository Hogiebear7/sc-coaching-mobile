import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { SupersetChips } from "@/components/ui/SupersetChips";
import { TextField } from "@/components/ui/TextField";
import { Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { buildClassWorkoutSummary } from "@/lib/class-summary";
import { setPendingWorkoutSummary } from "@/lib/workout-summary-handoff";
import { CARDIO_LABEL } from "@/lib/cardio";
import { ApiError } from "@/lib/api-client";
import { useExerciseLibraryNameIndex } from "@/lib/queries/exercise-library";
import {
  useUpdateClassWorkout,
  useWorkouts,
  type CreateWorkoutExerciseInput,
  type WorkoutSetType,
} from "@/lib/queries/workouts";
import { formatAsKg } from "@/lib/workout-formatters";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

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
  /** Place in the whole class workout, kept as the coach set it. */
  order: number | null;
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
    order: null,
  };
}

// Correcting a class-synced workout: only exercises + notes are editable —
// the title/date/duration come from the class itself, and there's no run
// tracking here (see /api/workouts/update's contract). Coaches often don't
// get around to filling in everyone's weights, so this has no time limit —
// members can fix their own numbers whenever they notice.
export default function EditClassWorkoutScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useWorkouts();
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const updateClassWorkout = useUpdateClassWorkout();

  const session = useMemo(() => data?.sessions.find((s) => s.id === id), [data, id]);

  const [notes, setNotes] = useState("");
  // How hard the whole session felt, 1 to 10, and a few words about it.
  const [rpe, setRpe] = useState<number | null>(null);
  const [feeling, setFeeling] = useState("");
  const [exerciseRows, setExerciseRows] = useState<EditExerciseRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && !hydrated) {
    setNotes(session.notes ?? "");
    setRpe(session.sessionRpe ?? null);
    setFeeling(session.feelingNotes ?? "");
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
        order: ex.order ?? null,
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
        order: row.order,
        notes: row.notes.trim() || null,
      }));

    if (exercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }

    try {
      await updateClassWorkout.mutateAsync({
        sessionId: session.id,
        exercises,
        notes: notes.trim(),
        sessionRpe: rpe,
        feelingNotes: feeling.trim(),
      });
      successFeedback();
      // Finishing leads to the summary (volume, sets, any personal bests), the same screen a self-logged workout ends on.
      setPendingWorkoutSummary(buildClassWorkoutSummary(session, exercises, data?.personalBests ?? []));
      router.replace("/workout-summary");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Your class workout</Text>
          <View style={{ width: 36 }} />
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
          <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
            <Text style={styles.subhead}>
              {session.title} — {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </Text>
            <Text style={styles.hint}>
              Check this is what you did and change anything that was different. Then tell us how it felt and you will see your summary.
            </Text>

            {session.runs.length > 0 ? (
              <Card style={styles.entryCard}>
                <Text style={styles.entryLabel}>Cardio in this class</Text>
                {session.runs.map((r, i) => (
                  <Text key={i} style={styles.hint}>
                    {CARDIO_LABEL[r.cardioType ?? "run"]}
                    {r.durationSecs ? ` · ${Math.round(r.durationSecs / 60)} min` : ""}
                    {r.distance ? ` · ${r.distance} km` : ""}
                  </Text>
                ))}
              </Card>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Exercises</Text>
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
                  libraryNames={libraryIndex?.items ?? []}
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

            <Card style={styles.entryCard}>
              <Text style={styles.entryLabel}>How hard did that feel?</Text>
              <Text style={styles.hint}>1 is very easy, 10 is as hard as it gets.</Text>
              <View style={styles.rpeRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => {
                      tapFeedback();
                      setRpe((prev) => (prev === n ? null : n));
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: rpe === n }}
                    accessibilityLabel={`Effort ${n} out of 10`}
                    style={[styles.rpeChip, rpe === n && styles.rpeChipActive]}
                  >
                    <Text style={[styles.rpeText, rpe === n && styles.rpeTextActive]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
              <TextField
                label="A few words on how it felt (optional)"
                value={feeling}
                onChangeText={setFeeling}
                placeholder="e.g. Legs were tired, shoulders felt good"
                multiline
                style={styles.multiline}
              />
            </Card>

            <TextField
              label="Session notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else about the class?"
              multiline
              style={styles.multiline}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actionsRow}>
              <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
              <Button
                title="Save and see my summary"
                onPress={handleSave}
                loading={updateClassWorkout.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </KeyboardAwareScroll>
        )}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    subhead: { fontSize: 14, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.sm },
    hint: { fontSize: 14, color: Color.textMuted, marginTop: 4, lineHeight: 20 },
    multiline: { minHeight: 80, textAlignVertical: "top", paddingTop: Spacing.sm, marginTop: Spacing.md },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.lg, marginBottom: Spacing.sm },
    sectionLabel: { fontSize: 19, fontWeight: "600", color: Color.textPrimary },
    addChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    addChipText: { fontSize: 14, fontWeight: "600", color: Color.textSecondary },
    emptyHint: { fontSize: 13, color: Color.textFaint, paddingVertical: Spacing.md },
    entryCard: { padding: Spacing.md, marginBottom: Spacing.md },
    entryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
    entryLabel: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
    removeText: { fontSize: 13, fontWeight: "600", color: Color.danger },
    fieldLabel: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
    gridRow: { flexDirection: "row", gap: Spacing.sm },
    gridInput: { flex: 1 },
    perSideRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.sm },
    perSideText: { fontSize: 14, fontWeight: "500", color: Color.textMuted },
    perSideTextActive: { color: Color.textPrimary },
    rpeRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
    rpeChip: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Color.surface2 },
    rpeChipActive: { backgroundColor: Color.gold },
    rpeText: { fontSize: 16, fontWeight: "600", color: Color.textSecondary },
    rpeTextActive: { color: Color.goldForeground },
    error: { fontSize: 13, color: Color.danger, marginTop: Spacing.sm },
    actionsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  })
);
