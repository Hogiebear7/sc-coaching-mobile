import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { ApiError } from "@/lib/api-client";
import { useAdvanceProgram, useMyProgram } from "@/lib/queries/programs";
import {
  SET_TYPE_OPTIONS,
  useCreateWorkout,
  useWorkouts,
  type CreateWorkoutExerciseInput,
  type CreateWorkoutRunInput,
  type WorkoutSetType,
} from "@/lib/queries/workouts";
import { formatAsKg, formatAsMmSs, livePace, parseDuration, todayDateString } from "@/lib/workout-formatters";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `${Date.now()}-${keySeq}`;
}

type SetRow = { key: string; weight: string; reps: string; setType: WorkoutSetType };

type ExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  weight: string;
  reps: string;
  sets: string;
  notes: string;
  rir: string;
  setRows: SetRow[];
  unitMode: "weight" | "time";
  setType: WorkoutSetType;
  supersetWithPrev: boolean;
};

type RunRow = {
  key: string;
  distance: string;
  distanceUnit: "km" | "m";
  duration: string;
  reps: string;
  sets: string;
  notes: string;
};

function newExerciseRow(): ExerciseRow {
  return {
    key: nextKey(),
    exerciseId: null,
    name: "",
    weight: "",
    reps: "",
    sets: "",
    notes: "",
    rir: "",
    setRows: [],
    unitMode: "weight",
    setType: "standard",
    supersetWithPrev: false,
  };
}

// Small chip row shared by the per-exercise and per-set type pickers.
function SetTypeChips({ value, onChange, compact }: { value: WorkoutSetType; onChange: (v: WorkoutSetType) => void; compact?: boolean }) {
  return (
    <View style={styles.setTypeRow}>
      {SET_TYPE_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.setTypeChip, compact && styles.setTypeChipCompact, value === opt.value && styles.setTypeChipActive]}
        >
          <Text style={[styles.setTypeChipText, value === opt.value && styles.setTypeChipTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function newRunRow(): RunRow {
  return { key: nextKey(), distance: "", distanceUnit: "km", duration: "", reps: "", sets: "", notes: "" };
}

function NumberField({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.numberField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={Color.textFaint}
        style={styles.smallInput}
      />
    </View>
  );
}

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { programId, dayId, title: initialTitle } = useLocalSearchParams<{
    programId?: string;
    dayId?: string;
    title?: string;
  }>();
  const { data } = useWorkouts();
  const { data: program } = useMyProgram();
  const create = useCreateWorkout();
  const advanceProgram = useAdvanceProgram();

  const [title, setTitle] = useState(initialTitle ?? "");
  const [date, setDate] = useState(todayDateString());
  const [durationMins, setDurationMins] = useState("");
  const [notes, setNotes] = useState("");
  const [exerciseRows, setExerciseRows] = useState<ExerciseRow[]>([]);
  const [runRows, setRunRows] = useState<RunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seededFromProgram, setSeededFromProgram] = useState(false);

  // Arriving from the Workouts tab's Active Program card — prefill this
  // day's prescribed exercises (name, target sets, set type) so the member
  // only has to fill in what they actually did.
  useEffect(() => {
    if (seededFromProgram || !programId || !dayId || !program) return;
    const day = program.days.find((d) => d.id === dayId);
    if (!day) return;

    const seenGroups = new Set<string>();
    setExerciseRows(
      day.exercises.map((ex) => {
        const supersetWithPrev = ex.supersetGroup ? seenGroups.has(ex.supersetGroup) : false;
        if (ex.supersetGroup) seenGroups.add(ex.supersetGroup);
        return {
          key: nextKey(),
          exerciseId: ex.exerciseId,
          name: ex.name,
          weight: "",
          reps: "",
          sets: ex.targetSets !== null ? String(ex.targetSets) : "",
          notes: "",
          rir: "",
          setRows: [],
          unitMode: "weight",
          setType: ex.setType ?? "standard",
          supersetWithPrev,
        };
      })
    );
    setSeededFromProgram(true);
  }, [programId, dayId, program, seededFromProgram]);

  function updateRow(key: string, patch: Partial<Omit<ExerciseRow, "key">>) {
    setExerciseRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setExerciseRows((prev) => prev.filter((r) => r.key !== key));
  }
  function updateRunRow(key: string, patch: Partial<Omit<RunRow, "key">>) {
    setRunRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRunRow(key: string) {
    setRunRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim() || !date.trim()) {
      setError("Title and date are required.");
      return;
    }

    const rowsWithContent = exerciseRows.filter((r) => r.name.trim());

    // Two exercises sharing a group id were performed back-to-back as a
    // superset. "Superset with previous" on row N links it to row N-1,
    // minting a fresh group id for the pair (or reusing one already
    // assigned if a third exercise chains onto the same pair).
    const groupByIndex = new Map<number, string>();
    let nextGroupSeq = 0;
    rowsWithContent.forEach((r, idx) => {
      if (r.supersetWithPrev && idx > 0) {
        const group = groupByIndex.get(idx - 1) ?? `ss-${nextGroupSeq++}`;
        groupByIndex.set(idx - 1, group);
        groupByIndex.set(idx, group);
      }
    });

    const exercises: CreateWorkoutExerciseInput[] = rowsWithContent.map((r, idx) => ({
      exerciseId: r.exerciseId,
      name: r.name.trim(),
      weight: r.weight.trim() || null,
      reps: r.reps.trim() ? parseInt(r.reps, 10) : null,
      sets: r.sets.trim() ? parseInt(r.sets, 10) : null,
      rir: r.rir.trim() ? parseInt(r.rir, 10) : null,
      setDetails: r.setRows
        .filter((sr) => sr.weight.trim() || sr.reps.trim())
        .map((sr) => ({
          weight: sr.weight.trim() || null,
          reps: sr.reps.trim() ? parseInt(sr.reps, 10) : null,
          setType: sr.setType === "standard" ? null : sr.setType,
        })),
      setType: r.setType === "standard" ? null : r.setType,
      supersetGroup: groupByIndex.get(idx) ?? null,
      notes: r.notes.trim() || null,
    }));

    const runs: CreateWorkoutRunInput[] = runRows.map((r) => ({
      distance: r.distance.trim() ? (r.distanceUnit === "m" ? Math.round((parseFloat(r.distance) / 1000) * 1000) / 1000 : parseFloat(r.distance)) : null,
      durationSecs: parseDuration(r.duration),
      reps: r.reps.trim() ? parseInt(r.reps, 10) : null,
      sets: r.sets.trim() ? parseInt(r.sets, 10) : null,
      notes: r.notes.trim() || null,
    }));

    try {
      await create.mutateAsync({ title: title.trim(), date: date.trim(), durationMins: durationMins.trim(), notes: notes.trim(), exercises, runs });
      if (programId) await advanceProgram.mutateAsync(programId);
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not log workout. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Log Workout</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Lower Body Strength" />
          <TextField label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <TextField label="Duration (minutes) — optional" value={durationMins} onChangeText={setDurationMins} keyboardType="number-pad" placeholder="e.g. 60" />
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
            <Text style={styles.emptyHint}>No entries yet. Use the buttons above to log exercises or a run.</Text>
          ) : null}

          {exerciseRows.map((row, idx) => (
            <Card key={row.key} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryLabel}>Exercise {idx + 1}</Text>
                <Pressable onPress={() => removeRow(row.key)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>

              {idx > 0 ? (
                <Pressable
                  onPress={() => updateRow(row.key, { supersetWithPrev: !row.supersetWithPrev })}
                  style={styles.supersetRow}
                >
                  <Ionicons
                    name={row.supersetWithPrev ? "checkbox" : "square-outline"}
                    size={16}
                    color={row.supersetWithPrev ? Color.gold : Color.textFaint}
                  />
                  <Text style={[styles.supersetText, row.supersetWithPrev && styles.supersetTextActive]}>
                    Superset with Exercise {idx}
                  </Text>
                </Pressable>
              ) : null}

              <Text style={styles.fieldLabel}>Exercise name</Text>
              <ExerciseAutocomplete
                exercises={data?.exerciseLibrary ?? []}
                value={row.name}
                onChange={(name, exerciseId) => updateRow(row.key, { name, exerciseId })}
              />

              <View style={styles.gridRow}>
                <View style={styles.numberField}>
                  <View style={styles.unitToggleRow}>
                    <Text style={styles.fieldLabel}>{row.unitMode === "time" ? "Time" : "Weight"}</Text>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      <Pressable onPress={() => updateRow(row.key, { unitMode: "weight" })} style={[styles.unitChip, row.unitMode === "weight" && styles.unitChipActive]}>
                        <Text style={[styles.unitChipText, row.unitMode === "weight" && styles.unitChipTextActive]}>kg</Text>
                      </Pressable>
                      <Pressable onPress={() => updateRow(row.key, { unitMode: "time" })} style={[styles.unitChip, row.unitMode === "time" && styles.unitChipActive]}>
                        <Text style={[styles.unitChipText, row.unitMode === "time" && styles.unitChipTextActive]}>time</Text>
                      </Pressable>
                    </View>
                  </View>
                  <TextInput
                    value={row.weight}
                    onChangeText={(v) => updateRow(row.key, { weight: v })}
                    onBlur={() => {
                      const formatted = row.unitMode === "time" ? formatAsMmSs(row.weight) : formatAsKg(row.weight);
                      if (formatted !== row.weight) updateRow(row.key, { weight: formatted });
                    }}
                    placeholder={row.unitMode === "time" ? "e.g. 1:30" : "e.g. 60"}
                    placeholderTextColor={Color.textFaint}
                    style={styles.smallInput}
                  />
                </View>
                <NumberField label="Reps" value={row.reps} onChangeText={(v) => updateRow(row.key, { reps: v })} placeholder="e.g. 8" />
              </View>
              <View style={styles.gridRow}>
                <NumberField label="Sets" value={row.sets} onChangeText={(v) => updateRow(row.key, { sets: v })} placeholder="e.g. 3" />
                <NumberField label="RIR (opt.)" value={row.rir} onChangeText={(v) => updateRow(row.key, { rir: v })} placeholder="e.g. 2" />
              </View>

              {row.setRows.length === 0 ? (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Set type</Text>
                  <SetTypeChips value={row.setType} onChange={(v) => updateRow(row.key, { setType: v })} />
                </>
              ) : null}

              {Number(row.sets) >= 2 && row.setRows.length === 0 ? (
                <Pressable
                  onPress={() =>
                    updateRow(row.key, {
                      setRows: Array.from({ length: Math.min(Number(row.sets), 12) }, () => ({
                        key: nextKey(),
                        weight: row.weight,
                        reps: row.reps,
                        setType: row.setType,
                      })),
                    })
                  }
                >
                  <Text style={styles.linkText}>Different weight/reps per set →</Text>
                </Pressable>
              ) : null}

              {row.setRows.length > 0 ? (
                <View style={styles.setRowsWrap}>
                  {row.setRows.map((set, setIdx) => (
                    <View key={set.key} style={styles.setRowBlock}>
                      <View style={styles.setRow}>
                        <Text style={styles.setLabel}>Set {setIdx + 1}</Text>
                        <TextInput
                          value={set.weight}
                          onChangeText={(v) => updateRow(row.key, { setRows: row.setRows.map((sr) => (sr.key === set.key ? { ...sr, weight: v } : sr)) })}
                          placeholder="Weight"
                          placeholderTextColor={Color.textFaint}
                          style={[styles.smallInput, { flex: 1 }]}
                        />
                        <TextInput
                          value={set.reps}
                          onChangeText={(v) => updateRow(row.key, { setRows: row.setRows.map((sr) => (sr.key === set.key ? { ...sr, reps: v } : sr)) })}
                          placeholder="Reps"
                          placeholderTextColor={Color.textFaint}
                          keyboardType="number-pad"
                          style={[styles.smallInput, { flex: 1 }]}
                        />
                      </View>
                      <SetTypeChips
                        compact
                        value={set.setType}
                        onChange={(v) => updateRow(row.key, { setRows: row.setRows.map((sr) => (sr.key === set.key ? { ...sr, setType: v } : sr)) })}
                      />
                    </View>
                  ))}
                  <Pressable onPress={() => updateRow(row.key, { setRows: [] })}>
                    <Text style={styles.linkTextMuted}>Use one value for all sets</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Notes (optional)</Text>
              <TextInput
                value={row.notes}
                onChangeText={(v) => updateRow(row.key, { notes: v })}
                placeholder="e.g. Felt strong, could go heavier"
                placeholderTextColor={Color.textFaint}
                style={styles.smallInput}
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
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Distance (optional)</Text>
                  <View style={{ flexDirection: "row", gap: Spacing.xs }}>
                    <TextInput
                      value={row.distance}
                      onChangeText={(v) => updateRunRow(row.key, { distance: v })}
                      keyboardType="decimal-pad"
                      placeholder={row.distanceUnit === "m" ? "e.g. 400" : "e.g. 5.2"}
                      placeholderTextColor={Color.textFaint}
                      style={[styles.smallInput, { flex: 1 }]}
                    />
                    <Pressable
                      onPress={() => updateRunRow(row.key, { distanceUnit: row.distanceUnit === "km" ? "m" : "km" })}
                      style={styles.unitSwitch}
                    >
                      <Text style={styles.unitSwitchText}>{row.distanceUnit}</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Time (mm:ss, optional)</Text>
                  <TextInput
                    value={row.duration}
                    onChangeText={(v) => updateRunRow(row.key, { duration: v })}
                    placeholder="e.g. 30:00"
                    placeholderTextColor={Color.textFaint}
                    style={styles.smallInput}
                  />
                </View>
              </View>

              {livePace(row.distance, row.distanceUnit, row.duration) ? (
                <Text style={styles.paceText}>
                  Pace: <Text style={{ color: Color.gold, fontWeight: "700" }}>{livePace(row.distance, row.distanceUnit, row.duration)}</Text>
                </Text>
              ) : null}

              <View style={styles.gridRow}>
                <NumberField label="Reps (opt.)" value={row.reps} onChangeText={(v) => updateRunRow(row.key, { reps: v })} placeholder="e.g. 8" />
                <NumberField label="Sets (opt.)" value={row.sets} onChangeText={(v) => updateRunRow(row.key, { sets: v })} placeholder="e.g. 3" />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Notes (optional)</Text>
              <TextInput
                value={row.notes}
                onChangeText={(v) => updateRunRow(row.key, { notes: v })}
                placeholder="e.g. Easy pace, felt good"
                placeholderTextColor={Color.textFaint}
                style={styles.smallInput}
              />
            </Card>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Log workout" onPress={handleSubmit} loading={create.isPending} style={{ marginTop: Spacing.lg }} />
        </ScrollView>
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
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  addChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  emptyHint: { fontSize: 12, color: Color.textMuted, borderWidth: 1, borderColor: Color.borderSubtle, borderStyle: "dashed", borderRadius: Radius.md, padding: Spacing.md },
  entryCard: { padding: Spacing.md, marginBottom: Spacing.md },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  entryLabel: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  removeText: { fontSize: 12, color: Color.danger },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 4 },
  gridRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  numberField: { flex: 1 },
  smallInput: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  unitToggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  unitChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  unitChipActive: { backgroundColor: Color.goldWeak },
  unitChipText: { fontSize: 10, fontWeight: "700", color: Color.textMuted },
  unitChipTextActive: { color: Color.gold },
  linkText: { fontSize: 12, fontWeight: "600", color: Color.gold, marginTop: Spacing.sm },
  linkTextMuted: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  setRowsWrap: { marginTop: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle, padding: Spacing.sm, gap: Spacing.sm },
  setRowBlock: { gap: 6 },
  setRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  setLabel: { fontSize: 11, color: Color.textMuted, width: 40 },
  supersetRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  supersetText: { fontSize: 12, color: Color.textMuted },
  supersetTextActive: { color: Color.gold, fontWeight: "600" },
  setTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  setTypeChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  setTypeChipCompact: { paddingHorizontal: Spacing.xs, paddingVertical: 4 },
  setTypeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  setTypeChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  setTypeChipTextActive: { color: Color.gold },
  unitSwitch: { width: 48, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface2 },
  unitSwitchText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  paceText: { fontSize: 11, color: Color.textMuted, marginTop: Spacing.xs },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
});
