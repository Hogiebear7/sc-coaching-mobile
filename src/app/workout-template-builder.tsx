import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { SupersetChips } from "@/components/ui/SupersetChips";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { useExerciseLibraryNameIndex } from "@/lib/queries/exercise-library";
import { tapFeedback } from "@/lib/haptics";
import type { PrescribedExercise } from "@/lib/queries/programs";
import {
  useCreateWorkoutTemplate,
  useDeleteWorkoutTemplate,
  useUpdateWorkoutTemplate,
  useWorkoutTemplates,
} from "@/lib/queries/workout-templates";
import { SET_TYPE_OPTIONS, useWorkouts, type WorkoutSetType } from "@/lib/queries/workouts";
import { takePendingWorkoutTemplateSeed } from "@/lib/workout-template-seed";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `tb-${Date.now()}-${keySeq}`;
}

type ExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  muscleTags: string;
  targetSets: string;
  targetReps: string;
  perSide: boolean;
  targetRepsRight: string;
  targetRepsLeft: string;
  targetWeight: string;
  setType: WorkoutSetType;
  notes: string;
  supersetGroup: string | null;
};

function newExerciseRow(): ExerciseRow {
  return {
    key: nextKey(),
    exerciseId: null,
    name: "",
    muscleTags: "",
    targetSets: "",
    targetReps: "",
    perSide: false,
    targetRepsRight: "",
    targetRepsLeft: "",
    targetWeight: "",
    setType: "standard",
    notes: "",
    supersetGroup: null,
  };
}

// targetReps is free text ("8-10", "AMRAP", ...), so a per-side split is
// encoded into that same string ("R8 / L6") rather than needing new backend
// fields — decoded back into the two-box UI on edit when it matches.
const PER_SIDE_REPS_PATTERN = /^R(.*) \/ L(.*)$/;

function encodePerSideReps(right: string, left: string): string {
  return `R${right.trim()} / L${left.trim()}`;
}

function decodeTargetReps(value: string | null): Pick<ExerciseRow, "targetReps" | "perSide" | "targetRepsRight" | "targetRepsLeft"> {
  const match = value?.match(PER_SIDE_REPS_PATTERN);
  if (match) {
    return { targetReps: "", perSide: true, targetRepsRight: match[1].trim(), targetRepsLeft: match[2].trim() };
  }
  return { targetReps: value ?? "", perSide: false, targetRepsRight: "", targetRepsLeft: "" };
}

function templateToRows(exercises: PrescribedExercise[]): ExerciseRow[] {
  return exercises.map((ex) => ({
    key: nextKey(),
    exerciseId: ex.exerciseId,
    name: ex.name,
    muscleTags: ex.muscleTags.join(", "),
    targetSets: ex.targetSets !== null ? String(ex.targetSets) : "",
    targetWeight: ex.targetWeight ?? "",
    setType: ex.setType ?? "standard",
    notes: ex.notes ?? "",
    supersetGroup: ex.supersetGroup,
    ...decodeTargetReps(ex.targetReps),
  }));
}

function rowsToExercises(rows: ExerciseRow[]): PrescribedExercise[] {
  const withContent = rows.filter((r) => r.name.trim());

  return withContent.map((r) => ({
    id: nextKey(),
    exerciseId: r.exerciseId,
    name: r.name.trim(),
    muscleTags: r.muscleTags.split(",").map((t) => t.trim()).filter(Boolean),
    targetSets: r.targetSets.trim() ? parseInt(r.targetSets, 10) : null,
    targetReps: r.perSide
      ? r.targetRepsRight.trim() || r.targetRepsLeft.trim()
        ? encodePerSideReps(r.targetRepsRight, r.targetRepsLeft)
        : null
      : r.targetReps.trim() || null,
    targetWeight: r.targetWeight.trim() || null,
    setType: r.setType === "standard" ? null : r.setType,
    sets: null,
    supersetGroup: r.supersetGroup,
    notes: r.notes.trim() || null,
  }));
}

function SetTypeChips({ value, onChange }: { value: WorkoutSetType; onChange: (v: WorkoutSetType) => void }) {
  return (
    <View style={styles.setTypeRow}>
      {SET_TYPE_OPTIONS.map((opt) => (
        <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={[styles.setTypeChip, value === opt.value && styles.setTypeChipActive]}>
          <Text style={[styles.setTypeChipText, value === opt.value && styles.setTypeChipTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function WorkoutTemplateBuilderScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { data: templates, isLoading } = useWorkoutTemplates();
  const { data: workoutsData } = useWorkouts();
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const createTemplate = useCreateWorkoutTemplate();
  const updateTemplate = useUpdateWorkoutTemplate();
  const deleteTemplate = useDeleteWorkoutTemplate();

  const existing = templateId ? templates?.find((t) => t.id === templateId) : undefined;
  const isEditing = !!existing;

  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || isLoading) return;
    if (existing) {
      setName(existing.name);
      setExercises(templateToRows(existing.exercises));
    } else if (!templateId) {
      // "Save as template" from a just-logged workout hands its exercises
      // over this way (see log-workout.tsx) rather than a route param — a
      // read-once in-memory value, so it only ever applies on this first,
      // genuinely-fresh visit.
      const seed = takePendingWorkoutTemplateSeed();
      if (seed) {
        setName(seed.name);
        setExercises(seed.exercises.length > 0 ? templateToRows(seed.exercises) : [newExerciseRow()]);
      } else {
        setExercises([newExerciseRow()]);
      }
    }
    setHydrated(true);
  }, [existing, hydrated, isLoading, templateId]);

  function updateExercise(key: string, patch: Partial<Omit<ExerciseRow, "key">>) {
    setExercises((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  function removeExercise(key: string) {
    setExercises((prev) => prev.filter((e) => e.key !== key));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Give this workout a name.");
      return;
    }
    const payloadExercises = rowsToExercises(exercises);
    if (payloadExercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }

    try {
      if (isEditing && existing) {
        await updateTemplate.mutateAsync({ id: existing.id, name: name.trim(), exercises: payloadExercises });
      } else {
        await createTemplate.mutateAsync({ name: name.trim(), exercises: payloadExercises });
      }
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this workout. Please try again.");
    }
  }

  function handleArchive() {
    if (!existing) return;
    Alert.alert("Archive workout?", `"${existing.name}" moves to your Archive — you can restore it any time.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        onPress: async () => {
          await updateTemplate.mutateAsync({ id: existing.id, name: existing.name, exercises: existing.exercises, archived: true });
          tapFeedback();
          router.back();
        },
      },
    ]);
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert("Delete permanently?", `"${existing.name}" will be gone for good.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTemplate.mutateAsync(existing.id);
          tapFeedback();
          router.back();
        },
      },
    ]);
  }

  const saving = createTemplate.isPending || updateTemplate.isPending;

  if (isLoading && !hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? "Edit Workout" : "New Workout"}</Text>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
          <TextField label="Workout name" value={name} onChangeText={setName} placeholder="e.g. Upper Body A" />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>EXERCISES</Text>
            <Pressable onPress={() => setExercises((prev) => [...prev, newExerciseRow()])} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Exercise</Text>
            </Pressable>
          </View>

          {exercises.map((ex, idx) => (
            <Card key={ex.key} style={styles.exerciseCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryLabel}>Exercise {idx + 1}</Text>
                <Pressable onPress={() => removeExercise(ex.key)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Superset (opt.)</Text>
              <SupersetChips
                value={ex.supersetGroup}
                allGroups={exercises.map((e) => e.supersetGroup)}
                onChange={(v) => updateExercise(ex.key, { supersetGroup: v })}
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Exercise name</Text>
              <ExerciseAutocomplete
                exercises={workoutsData?.exerciseLibrary ?? []}
                libraryNames={libraryIndex?.items ?? []}
                value={ex.name}
                onChange={(exName, exerciseId) => updateExercise(ex.key, { name: exName, exerciseId })}
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Muscle tags (comma separated)</Text>
              <TextInput
                value={ex.muscleTags}
                onChangeText={(v) => updateExercise(ex.key, { muscleTags: v })}
                placeholder="e.g. Chest, Triceps"
                placeholderTextColor={Color.textFaint}
                style={styles.smallInput}
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Target sets</Text>
              <TextInput
                value={ex.targetSets}
                onChangeText={(v) => updateExercise(ex.key, { targetSets: v })}
                keyboardType="number-pad"
                placeholder="e.g. 4"
                placeholderTextColor={Color.textFaint}
                style={styles.smallInput}
              />

              <View style={styles.repsHeaderRow}>
                <Text style={styles.fieldLabel}>Target reps</Text>
                <Pressable
                  onPress={() => updateExercise(ex.key, { perSide: !ex.perSide })}
                  style={styles.perSideRow}
                >
                  <Ionicons
                    name={ex.perSide ? "checkbox" : "square-outline"}
                    size={16}
                    color={ex.perSide ? Color.gold : Color.textFaint}
                  />
                  <Text style={[styles.perSideText, ex.perSide && styles.perSideTextActive]}>Per arm/leg</Text>
                </Pressable>
              </View>

              {ex.perSide ? (
                <View style={styles.gridRow}>
                  <View style={styles.numberField}>
                    <Text style={styles.fieldLabel}>Right</Text>
                    <TextInput
                      value={ex.targetRepsRight}
                      onChangeText={(v) => updateExercise(ex.key, { targetRepsRight: v })}
                      placeholder="e.g. 8"
                      placeholderTextColor={Color.textFaint}
                      style={styles.smallInput}
                    />
                  </View>
                  <View style={styles.numberField}>
                    <Text style={styles.fieldLabel}>Left</Text>
                    <TextInput
                      value={ex.targetRepsLeft}
                      onChangeText={(v) => updateExercise(ex.key, { targetRepsLeft: v })}
                      placeholder="e.g. 8"
                      placeholderTextColor={Color.textFaint}
                      style={styles.smallInput}
                    />
                  </View>
                </View>
              ) : (
                <TextInput
                  value={ex.targetReps}
                  onChangeText={(v) => updateExercise(ex.key, { targetReps: v })}
                  placeholder="e.g. 8-10"
                  placeholderTextColor={Color.textFaint}
                  style={styles.smallInput}
                />
              )}

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Target weight / guidance (optional)</Text>
              <TextInput
                value={ex.targetWeight}
                onChangeText={(v) => updateExercise(ex.key, { targetWeight: v })}
                placeholder="e.g. 60kg or RPE 8"
                placeholderTextColor={Color.textFaint}
                style={styles.smallInput}
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Set type</Text>
              <SetTypeChips value={ex.setType} onChange={(v) => updateExercise(ex.key, { setType: v })} />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Notes (optional)</Text>
              <TextInput
                value={ex.notes}
                onChangeText={(v) => updateExercise(ex.key, { notes: v })}
                placeholder="e.g. Control the eccentric"
                placeholderTextColor={Color.textFaint}
                style={styles.smallInput}
              />
            </Card>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title={isEditing ? "Save changes" : "Save workout"} onPress={handleSave} loading={saving} style={{ marginTop: Spacing.lg }} />

          {isEditing ? (
            <>
              <Pressable onPress={handleArchive} style={styles.secondaryRow}>
                <Text style={styles.secondaryRowText}>Archive workout</Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.secondaryRow}>
                <Text style={styles.deleteText}>Delete permanently</Text>
              </Pressable>
            </>
          ) : null}
        </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  addChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  exerciseCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  entryLabel: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  removeText: { fontSize: 12, color: Color.danger },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 4 },
  repsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.sm },
  perSideRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  perSideText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  perSideTextActive: { color: Color.gold },
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
  setTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  setTypeChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  setTypeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  setTypeChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  setTypeChipTextActive: { color: Color.gold },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
  secondaryRow: { alignItems: "center", marginTop: Spacing.md, paddingVertical: Spacing.sm },
  secondaryRowText: { fontSize: 13, color: Color.textMuted, fontWeight: "600" },
  deleteText: { fontSize: 13, color: Color.danger, fontWeight: "600" },
});
