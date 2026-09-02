import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { SupersetChips } from "@/components/ui/SupersetChips";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { ApiError } from "@/lib/api-client";
import { useExerciseLibraryNameIndex } from "@/lib/queries/exercise-library";
import {
  SET_TYPE_OPTIONS,
  useEditWorkout,
  useWorkouts,
  type CreateWorkoutExerciseInput,
  type CreateWorkoutRunInput,
  type WorkoutSetType,
} from "@/lib/queries/workouts";
import { formatAsKg, formatDuration, parseDuration, todayDateString } from "@/lib/workout-formatters";

type EditSetRow = {
  key: string;
  weight: string;
  reps: string;
  setType: WorkoutSetType;
  // Preserved but not editable here — log-workout.tsx is where a per-side
  // set is actually entered/split; this screen just must not silently drop
  // these values on an unrelated save.
  repsRight: string;
  repsLeft: string;
};

function nextEditSetType(current: WorkoutSetType): WorkoutSetType {
  const idx = SET_TYPE_OPTIONS.findIndex((opt) => opt.value === current);
  return SET_TYPE_OPTIONS[(idx + 1) % SET_TYPE_OPTIONS.length].value;
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `edit-${Date.now()}-${keySeq}`;
}

type EditExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  // Editable per-set — each set's own weight/reps/type, same as when the
  // workout was first logged. Fixes a real gap: a bad value in one specific
  // set (rather than the shared summary) previously had no way to be
  // corrected here at all.
  setRows: EditSetRow[];
  rir: string;
  notes: string;
  supersetGroup: string | null;
  perSide: boolean;
};

type EditRunRow = {
  key: string;
  distance: string;
  duration: string;
  reps: string;
  sets: string;
  notes: string;
};

function newEditSetRow(setType: WorkoutSetType = "standard"): EditSetRow {
  return { key: nextKey(), weight: "", reps: "", repsRight: "", repsLeft: "", setType };
}

// Older entries (or ones logged as a single summary rather than per-set)
// don't have setDetails — expand them into that many identical rows so
// there's always a real per-set list to edit, seeded from whatever the
// summary already said.
function deriveSetRows(ex: {
  weight: string | null;
  reps: number | null;
  sets: number | null;
  setType?: WorkoutSetType | null;
  setDetails?: CreateWorkoutExerciseInput["setDetails"] | null;
}): EditSetRow[] {
  if (ex.setDetails && ex.setDetails.length > 0) {
    return ex.setDetails.map((sd) => ({
      key: nextKey(),
      weight: sd.weight ?? "",
      reps: sd.reps != null ? String(sd.reps) : "",
      setType: sd.setType ?? "standard",
      repsRight: sd.repsRight != null ? String(sd.repsRight) : "",
      repsLeft: sd.repsLeft != null ? String(sd.repsLeft) : "",
    }));
  }
  const count = ex.sets && ex.sets > 0 ? ex.sets : 1;
  return Array.from({ length: count }, () => ({
    key: nextKey(),
    weight: ex.weight ?? "",
    reps: ex.reps != null ? String(ex.reps) : "",
    setType: ex.setType ?? "standard",
    repsRight: "",
    repsLeft: "",
  }));
}

function newExerciseRow(): EditExerciseRow {
  return {
    key: nextKey(),
    exerciseId: null,
    name: "",
    setRows: [newEditSetRow()],
    rir: "",
    notes: "",
    supersetGroup: null,
    perSide: false,
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
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
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
        setRows: deriveSetRows(ex),
        rir: ex.rir != null ? String(ex.rir) : "",
        notes: ex.notes ?? "",
        supersetGroup: ex.supersetGroup ?? null,
        perSide: ex.perSide ?? false,
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

  function updateSetRow(rowKey: string, setKey: string, patch: Partial<Omit<EditSetRow, "key">>) {
    setExerciseRows((prev) =>
      prev.map((r) =>
        r.key === rowKey ? { ...r, setRows: r.setRows.map((sr) => (sr.key === setKey ? { ...sr, ...patch } : sr)) } : r
      )
    );
  }

  function addSetRow(rowKey: string) {
    tapFeedback();
    setExerciseRows((prev) =>
      prev.map((r) => (r.key === rowKey ? { ...r, setRows: [...r.setRows, newEditSetRow(r.setRows[0]?.setType)] } : r))
    );
  }

  function removeSetRow(rowKey: string, setKey: string) {
    tapFeedback();
    setExerciseRows((prev) =>
      prev.map((r) => (r.key === rowKey ? { ...r, setRows: r.setRows.filter((sr) => sr.key !== setKey) } : r))
    );
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
      .map((row) => {
        const filled = row.setRows.filter((sr) => sr.weight.trim() || sr.reps.trim() || sr.repsRight.trim() || sr.repsLeft.trim());
        const first = filled[0];
        return {
          exerciseId: row.exerciseId,
          name: row.name.trim(),
          weight: first?.weight?.trim() || null,
          reps: first?.reps?.trim() ? parseInt(first.reps, 10) : null,
          sets: filled.length || null,
          rir: row.rir.trim() ? parseInt(row.rir, 10) : null,
          setDetails: filled.map((sr) => ({
            weight: sr.weight.trim() || null,
            reps: sr.reps.trim() ? parseInt(sr.reps, 10) : null,
            setType: sr.setType === "standard" ? null : sr.setType,
            repsRight: sr.repsRight.trim() ? parseInt(sr.repsRight, 10) : null,
            repsLeft: sr.repsLeft.trim() ? parseInt(sr.repsLeft, 10) : null,
          })),
          setType: first && first.setType !== "standard" ? first.setType : null,
          supersetGroup: row.supersetGroup,
          perSide: row.perSide,
          notes: row.notes.trim() || null,
        };
      });

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
              Class workouts are corrected from Session Detail&apos;s Edit link, not here.
            </Text>
            <Button title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
          </View>
        ) : (
          <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
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

                <View style={styles.setColumnHeader}>
                  <Text style={[styles.setColumnLabel, { width: 36 }]}>Set</Text>
                  <Text style={[styles.setColumnLabel, { flex: 1 }]}>Weight</Text>
                  <Text style={[styles.setColumnLabel, { flex: 1 }]}>Reps</Text>
                  <View style={{ width: 24 }} />
                </View>
                {row.setRows.map((sr, setIdx) => (
                  <View key={sr.key} style={styles.setEditRow}>
                    <Pressable
                      onPress={() => updateSetRow(row.key, sr.key, { setType: nextEditSetType(sr.setType) })}
                      style={{ width: 36 }}
                    >
                      <Text style={styles.setNumber}>{setIdx + 1}</Text>
                      {sr.setType !== "standard" ? (
                        <Text style={styles.setTypeTag} numberOfLines={1}>
                          {SET_TYPE_OPTIONS.find((o) => o.value === sr.setType)?.label}
                        </Text>
                      ) : null}
                    </Pressable>
                    <TextInput
                      value={sr.weight}
                      onChangeText={(v) => updateSetRow(row.key, sr.key, { weight: v })}
                      onBlur={() => {
                        const formatted = formatAsKg(sr.weight);
                        if (formatted !== sr.weight) updateSetRow(row.key, sr.key, { weight: formatted });
                      }}
                      placeholder="e.g. 60"
                      placeholderTextColor={Color.textFaint}
                      style={[styles.setInput, { flex: 1 }]}
                    />
                    <TextInput
                      value={sr.reps}
                      onChangeText={(v) => updateSetRow(row.key, sr.key, { reps: v })}
                      keyboardType="number-pad"
                      placeholder="e.g. 8"
                      placeholderTextColor={Color.textFaint}
                      style={[styles.setInput, { flex: 1 }]}
                    />
                    <Pressable onPress={() => removeSetRow(row.key, sr.key)} hitSlop={8} style={{ width: 24, alignItems: "center" }}>
                      <Ionicons name="close" size={16} color={Color.textFaint} />
                    </Pressable>
                  </View>
                ))}
                <View style={styles.setRowActions}>
                  <Pressable onPress={() => addSetRow(row.key)}>
                    <Text style={styles.addSetText}>+ Add set</Text>
                  </Pressable>
                  {row.setRows.length > 1 ? (
                    <Pressable onPress={() => removeSetRow(row.key, row.setRows[row.setRows.length - 1].key)}>
                      <Text style={styles.removeSetText}>Remove last set</Text>
                    </Pressable>
                  ) : null}
                </View>

                <TextField
                  label="RIR (opt.)"
                  value={row.rir}
                  onChangeText={(v) => updateRow(row.key, { rir: v })}
                  keyboardType="number-pad"
                  placeholder="e.g. 2"
                  style={{ marginTop: Spacing.sm }}
                />

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
          </KeyboardAwareScroll>
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
  setColumnHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: 2 },
  setColumnLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, color: Color.textFaint, textTransform: "uppercase" },
  setEditRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xs, padding: 4 },
  setNumber: { fontSize: 13, fontWeight: "700", color: Color.textPrimary, textAlign: "center" },
  setTypeTag: { fontSize: 7, fontWeight: "700", color: Color.gold, textAlign: "center", textTransform: "uppercase" },
  setInput: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Color.textPrimary,
  },
  setRowActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm },
  addSetText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  removeSetText: { fontSize: 12, color: Color.textMuted },
  perSideRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.sm },
  perSideText: { fontSize: 12, fontWeight: "500", color: Color.textMuted },
  perSideTextActive: { color: Color.textPrimary },
  error: { fontSize: 13, color: Color.danger, marginTop: Spacing.sm },
  actionsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
});
