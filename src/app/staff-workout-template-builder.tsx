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
import {
  useDeleteStaffWorkoutTemplate,
  useSaveStaffWorkoutTemplate,
  useStaffClassCategories,
  useStaffWorkoutTemplates,
  type StaffTemplateExercise,
} from "@/lib/queries/staff";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `stb-${Date.now()}-${keySeq}`;
}

type ExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  weight: string;
  reps: string;
  repsRight: string;
  repsLeft: string;
  perSide: boolean;
  sets: string;
  supersetGroup: string | null;
};

function newExerciseRow(): ExerciseRow {
  return {
    key: nextKey(),
    exerciseId: null,
    name: "",
    weight: "",
    reps: "",
    repsRight: "",
    repsLeft: "",
    perSide: false,
    sets: "",
    supersetGroup: null,
  };
}

function templateToRows(exercises: StaffTemplateExercise[]): ExerciseRow[] {
  return exercises.map((ex) => ({
    key: nextKey(),
    exerciseId: ex.exerciseId,
    name: ex.name,
    weight: ex.weight,
    reps: ex.reps !== null ? String(ex.reps) : "",
    repsRight: ex.repsRight !== null ? String(ex.repsRight) : "",
    repsLeft: ex.repsLeft !== null ? String(ex.repsLeft) : "",
    perSide: ex.perSide,
    sets: ex.sets !== null ? String(ex.sets) : "",
    supersetGroup: ex.supersetGroup,
  }));
}

function rowsToExercises(rows: ExerciseRow[]): StaffTemplateExercise[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      exerciseId: r.exerciseId,
      name: r.name.trim(),
      weight: r.weight.trim(),
      reps: !r.perSide && r.reps.trim() ? parseInt(r.reps, 10) : null,
      sets: r.sets.trim() ? parseInt(r.sets, 10) : null,
      supersetGroup: r.supersetGroup,
      perSide: r.perSide,
      repsRight: r.perSide && r.repsRight.trim() ? parseInt(r.repsRight, 10) : null,
      repsLeft: r.perSide && r.repsLeft.trim() ? parseInt(r.repsLeft, 10) : null,
    }));
}

export default function StaffWorkoutTemplateBuilderScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { data, isLoading } = useStaffWorkoutTemplates();
  const { data: categories } = useStaffClassCategories();
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const saveTemplate = useSaveStaffWorkoutTemplate();
  const deleteTemplate = useDeleteStaffWorkoutTemplate();

  const existing = templateId ? data?.templates.find((t) => t.id === templateId) : undefined;
  const isEditing = !!existing;

  const [name, setName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || isLoading) return;
    if (existing) {
      setName(existing.name);
      setSelectedCategories(existing.categories);
      setNotes(existing.notes ?? "");
      setExercises(templateToRows(existing.exercises));
    } else if (!templateId) {
      setExercises([newExerciseRow()]);
    }
    setHydrated(true);
  }, [existing, hydrated, isLoading, templateId]);

  function updateExercise(key: string, patch: Partial<Omit<ExerciseRow, "key">>) {
    setExercises((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  function removeExercise(key: string) {
    setExercises((prev) => prev.filter((e) => e.key !== key));
  }
  function toggleCategory(slug: string) {
    setSelectedCategories((prev) => (prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Give this template a name.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Pick at least one class category.");
      return;
    }
    const payloadExercises = rowsToExercises(exercises);
    if (payloadExercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }

    try {
      await saveTemplate.mutateAsync({
        id: existing?.id,
        name: name.trim(),
        categories: selectedCategories,
        notes: notes.trim(),
        exercises: payloadExercises,
      });
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this template. Please try again.");
    }
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
          <Text style={styles.headerTitle}>{isEditing ? "Edit Template" : "New Template"}</Text>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
          <TextField label="Template name" value={name} onChangeText={setName} placeholder="e.g. Full Body Strength A" />

          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Classes this can be added to</Text>
          <View style={styles.categoryRow}>
            {(categories ?? []).map((c) => (
              <Pressable
                key={c.slug}
                onPress={() => toggleCategory(c.slug)}
                style={[styles.categoryChip, selectedCategories.includes(c.slug) && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, selectedCategories.includes(c.slug) && styles.categoryChipTextActive]}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>EXERCISES</Text>
            <Pressable onPress={() => setExercises((prev) => [...prev, newExerciseRow()])} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Exercise</Text>
            </Pressable>
          </View>
          <Text style={styles.hintText}>Give two or more exercises the same station label (ST1, ST2, …) to group them as a superset.</Text>

          {exercises.map((ex, idx) => (
            <Card key={ex.key} style={styles.exerciseCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryLabel}>Exercise {idx + 1}</Text>
                <Pressable onPress={() => removeExercise(ex.key)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Station (opt.)</Text>
              <SupersetChips
                value={ex.supersetGroup}
                allGroups={exercises.map((e) => e.supersetGroup)}
                onChange={(v) => updateExercise(ex.key, { supersetGroup: v })}
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Exercise name</Text>
              <ExerciseAutocomplete
                exercises={data?.libraryExercises ?? []}
                libraryNames={libraryIndex?.items ?? []}
                value={ex.name}
                onChange={(exName, exerciseId) => updateExercise(ex.key, { name: exName, exerciseId })}
              />

              <View style={styles.repsHeaderRow}>
                <Text style={styles.fieldLabel}>Reps</Text>
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
                      value={ex.repsRight}
                      onChangeText={(v) => updateExercise(ex.key, { repsRight: v })}
                      keyboardType="number-pad"
                      placeholder="e.g. 8"
                      placeholderTextColor={Color.textFaint}
                      style={styles.smallInput}
                    />
                  </View>
                  <View style={styles.numberField}>
                    <Text style={styles.fieldLabel}>Left</Text>
                    <TextInput
                      value={ex.repsLeft}
                      onChangeText={(v) => updateExercise(ex.key, { repsLeft: v })}
                      keyboardType="number-pad"
                      placeholder="e.g. 8"
                      placeholderTextColor={Color.textFaint}
                      style={styles.smallInput}
                    />
                  </View>
                </View>
              ) : (
                <TextInput
                  value={ex.reps}
                  onChangeText={(v) => updateExercise(ex.key, { reps: v })}
                  keyboardType="number-pad"
                  placeholder="e.g. 8"
                  placeholderTextColor={Color.textFaint}
                  style={styles.smallInput}
                />
              )}

              <View style={styles.gridRow}>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Weight</Text>
                  <TextInput
                    value={ex.weight}
                    onChangeText={(v) => updateExercise(ex.key, { weight: v })}
                    placeholder="e.g. 60kg"
                    placeholderTextColor={Color.textFaint}
                    style={styles.smallInput}
                  />
                </View>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Sets</Text>
                  <TextInput
                    value={ex.sets}
                    onChangeText={(v) => updateExercise(ex.key, { sets: v })}
                    keyboardType="number-pad"
                    placeholder="e.g. 4"
                    placeholderTextColor={Color.textFaint}
                    style={styles.smallInput}
                  />
                </View>
              </View>
            </Card>
          ))}

          <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Warm-up, focus, scaling options…"
            placeholderTextColor={Color.textFaint}
            style={[styles.smallInput, styles.notesInput]}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title={isEditing ? "Save changes" : "Create template"} onPress={handleSave} loading={saveTemplate.isPending} style={{ marginTop: Spacing.lg }} />

          {isEditing ? (
            <Pressable onPress={handleDelete} style={styles.secondaryRow}>
              <Text style={styles.deleteText}>Delete permanently</Text>
            </Pressable>
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
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 4 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  categoryChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  categoryChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  categoryChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  categoryChipTextActive: { color: Color.gold },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  addChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  hintText: { fontSize: 11, color: Color.textFaint, marginBottom: Spacing.sm, lineHeight: 15 },
  exerciseCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  entryLabel: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  removeText: { fontSize: 12, color: Color.danger },
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
  notesInput: { height: 64, textAlignVertical: "top", paddingTop: Spacing.sm },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
  secondaryRow: { alignItems: "center", marginTop: Spacing.md, paddingVertical: Spacing.sm },
  deleteText: { fontSize: 13, color: Color.danger, fontWeight: "600" },
});
