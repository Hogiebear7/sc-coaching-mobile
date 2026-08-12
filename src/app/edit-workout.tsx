import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { ApiError } from "@/lib/api-client";
import {
  useEditWorkout,
  useWorkouts,
  type CreateWorkoutExerciseInput,
  type CreateWorkoutRunInput,
  type WorkoutSetType,
} from "@/lib/queries/workouts";
import { formatAsKg, formatDuration, parseDuration, todayDateString } from "@/lib/workout-formatters";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `edit-${Date.now()}-${keySeq}`;
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
  // Carried through unchanged from the original entry — this screen edits
  // the shared weight/reps/sets/notes fields, not per-set breakdowns, superset
  // pairing, or a default set type, so those pass straight through on save.
  setDetails: CreateWorkoutExerciseInput["setDetails"];
  setType: WorkoutSetType | null;
  supersetGroup: string | null;
};

type EditRunRow = {
  key: string;
  distance: string;
  duration: string;
  reps: string;
  sets: string;
  notes: string;
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
  };
}

function newRunRow(): EditRunRow {
  return { key: nextKey(), distance: "", duration: "", reps: "", sets: "", notes: "" };
}

// A focused editor for a previously logged, self-logged session — any date,
// not just today. Deliberately simpler than log-workout.tsx: no live timer,
// no workout-format/circuit builders, no draft persistence, since none of
// that applies to correcting a workout that's already finished. Per-set
// breakdowns, superset grouping, and default set type aren't editable here
// either; they're preserved as-is on save (see EditExerciseRow above).
export default function EditWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useWorkouts();
  const editWorkout = useEditWorkout();

  const session = useMemo(() => data?.sessions.find((s) => s.id === id), [data, id]);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [durationMins, setDurationMins] = useState("");
  const [notes, setNotes] = useState("");
  const [exerciseRows, setExerciseRows] = useState<EditExerciseRow[]>([]);
  const [runRows, setRunRows] = useState<EditRunRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && !hydrated) {
    setTitle(session.title);
    setDate(session.date);
    setDurationMins(session.durationMins != null ? String(session.durationMins) : "");
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
      }))
    );
    setRunRows(
      session.runs.map((r) => ({
        key: nextKey(),
        distance: r.distance != null ? String(r.distance) : "",
        duration: r.durationSecs != null ? formatDuration(r.durationSecs) : "",
        reps: r.reps != null ? String(r.reps) : "",
        sets: r.sets != null ? String(r.sets) : "",
        notes: r.notes ?? "",
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

  function updateRunRow(key: string, patch: Partial<Omit<EditRunRow, "key">>) {
    setRunRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRunRow(key: string) {
    Alert.alert("Remove this run?", "Any details you've entered for it will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          setRunRows((prev) => prev.filter((r) => r.key !== key));
        },
      },
    ]);
  }

  async function handleSave() {
    if (!session) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!date.trim()) {
      setError("Date is required.");
      return;
    }
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
        notes: row.notes.trim() || null,
      }));

    const runs: CreateWorkoutRunInput[] = runRows.map((row) => ({
      distance: row.distance.trim() ? parseFloat(row.distance) : null,
      durationSecs: parseDuration(row.duration),
      reps: row.reps.trim() ? parseInt(row.reps, 10) : null,
      sets: row.sets.trim() ? parseInt(row.sets, 10) : null,
      notes: row.notes.trim() || null,
    }));

    try {
      await editWorkout.mutateAsync({
        id: session.id,
        title: title.trim(),
        date: date.trim(),
        durationMins: durationMins.trim(),
        notes: notes.trim(),
        exercises,
        runs,
      });
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Workout</Text>
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
        ) : session.classId ? (
          <View style={styles.centerFill}>
            <Text style={styles.emptyText}>
              Class workouts are corrected from the class card, not here — ask a coach if it needs a change.
            </Text>
            <Button title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Lower Body Strength" />
            <DateField label="Date" value={date} onChange={setDate} maxDate={todayDateString()} />
            <TextField
              label="Duration (minutes) — optional"
              value={durationMins}
              onChangeText={setDurationMins}
              keyboardType="number-pad"
              placeholder="e.g. 60"
            />
            <TextField
              label="Notes — optional"
              value={notes}
              onChangeText={setNotes}
              placeholder="What did you do, how did it feel"
              multiline
              style={styles.multiline}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>SESSION ENTRIES</Text>
              <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                <Pressable onPress={() => setExerciseRows((prev) => [...prev, newExerciseRow()])} style={styles.addChip}>
                  <Text style={styles.addChipText}>+ Exercise</Text>
                </Pressable>
                <Pressable onPress={() => setRunRows((prev) => [...prev, newRunRow()])} style={styles.addChip}>
                  <Text style={styles.addChipText}>+ Run</Text>
                </Pressable>
              </View>
            </View>

            {exerciseRows.length === 0 && runRows.length === 0 ? (
              <Text style={styles.emptyHint}>No entries yet. Use the buttons above to add exercises or a run.</Text>
            ) : null}

            {exerciseRows.map((row, idx) => (
              <Card key={row.key} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryLabel}>Exercise {idx + 1}</Text>
                  <Pressable onPress={() => removeRow(row.key)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>

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

                <TextField
                  label="Notes (optional)"
                  value={row.notes}
                  onChangeText={(v) => updateRow(row.key, { notes: v })}
                  placeholder="e.g. Felt strong, could go heavier"
                />
              </Card>
            ))}

            {runRows.map((row, idx) => (
              <Card key={row.key} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryLabel}>Run {idx + 1}</Text>
                  <Pressable onPress={() => removeRunRow(row.key)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>

                <View style={styles.gridRow}>
                  <TextField
                    label="Distance (km, opt.)"
                    value={row.distance}
                    onChangeText={(v) => updateRunRow(row.key, { distance: v })}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 5.2"
                    style={styles.gridInput}
                  />
                  <TextField
                    label="Time (mm:ss, opt.)"
                    value={row.duration}
                    onChangeText={(v) => updateRunRow(row.key, { duration: v })}
                    placeholder="e.g. 30:00"
                    style={styles.gridInput}
                  />
                </View>
                <View style={styles.gridRow}>
                  <TextField
                    label="Reps (opt.)"
                    value={row.reps}
                    onChangeText={(v) => updateRunRow(row.key, { reps: v })}
                    keyboardType="number-pad"
                    style={styles.gridInput}
                  />
                  <TextField
                    label="Sets (opt.)"
                    value={row.sets}
                    onChangeText={(v) => updateRunRow(row.key, { sets: v })}
                    keyboardType="number-pad"
                    style={styles.gridInput}
                  />
                </View>

                <TextField
                  label="Notes (optional)"
                  value={row.notes}
                  onChangeText={(v) => updateRunRow(row.key, { notes: v })}
                  placeholder="e.g. Easy pace, felt good"
                />
              </Card>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actionsRow}>
              <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
              <Button
                title="Save changes"
                onPress={handleSave}
                loading={editWorkout.isPending}
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
  multiline: { minHeight: 80, textAlignVertical: "top", paddingTop: Spacing.sm },
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
  error: { fontSize: 13, color: Color.danger, marginTop: Spacing.sm },
  actionsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
});
