import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { SupersetChips } from "@/components/ui/SupersetChips";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { useExerciseLibraryNameIndex } from "@/lib/queries/exercise-library";
import { tapFeedback } from "@/lib/haptics";
import {
  useCreateProgram,
  useDeleteProgram,
  useStaffPrograms,
  useUpdateProgram,
  type ProgramDay,
  type ProgramDayType,
  type TrainingProgram,
} from "@/lib/queries/programs";
import { SET_TYPE_OPTIONS, useWorkouts, type WorkoutSetType } from "@/lib/queries/workouts";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `pb-${Date.now()}-${keySeq}`;
}

type ExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  muscleTags: string;
  targetSets: string;
  targetReps: string;
  targetWeight: string;
  setType: WorkoutSetType;
  notes: string;
  supersetGroup: string | null;
};

type DayRow = {
  key: string;
  label: string;
  type: ProgramDayType;
  exercises: ExerciseRow[];
};

function newExerciseRow(): ExerciseRow {
  return {
    key: nextKey(),
    exerciseId: null,
    name: "",
    muscleTags: "",
    targetSets: "",
    targetReps: "",
    targetWeight: "",
    setType: "standard",
    notes: "",
    supersetGroup: null,
  };
}

const DAY_LABEL_SEQUENCE = ["Workout A", "Workout B", "Workout C", "Workout D", "Workout E", "Workout F"];

function newDayRow(existingCount: number): DayRow {
  return {
    key: nextKey(),
    label: DAY_LABEL_SEQUENCE[existingCount] ?? `Workout ${existingCount + 1}`,
    type: "workout",
    exercises: [],
  };
}

function programToRows(program: TrainingProgram): DayRow[] {
  return program.days.map((day) => ({
    key: nextKey(),
    label: day.label,
    type: day.type,
    exercises: day.exercises.map((ex) => ({
      key: nextKey(),
      exerciseId: ex.exerciseId,
      name: ex.name,
      muscleTags: ex.muscleTags.join(", "),
      targetSets: ex.targetSets !== null ? String(ex.targetSets) : "",
      targetReps: ex.targetReps ?? "",
      targetWeight: ex.targetWeight ?? "",
      setType: ex.setType ?? "standard",
      notes: ex.notes ?? "",
      supersetGroup: ex.supersetGroup,
    })),
  }));
}

function rowsToDays(rows: DayRow[]): ProgramDay[] {
  return rows.map((day) => {
    const exercisesWithContent = day.exercises.filter((e) => e.name.trim());

    return {
      id: nextKey(),
      label: day.label.trim() || "Day",
      type: day.type,
      exercises:
        day.type === "rest"
          ? []
          : exercisesWithContent.map((e) => ({
              id: nextKey(),
              exerciseId: e.exerciseId,
              name: e.name.trim(),
              muscleTags: e.muscleTags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              targetSets: e.targetSets.trim() ? parseInt(e.targetSets, 10) : null,
              targetReps: e.targetReps.trim() || null,
              targetWeight: e.targetWeight.trim() || null,
              setType: e.setType === "standard" ? null : e.setType,
              sets: null,
              supersetGroup: e.supersetGroup,
              notes: e.notes.trim() || null,
            })),
    };
  });
}

function DayTypeToggle({ value, onChange }: { value: ProgramDayType; onChange: (v: ProgramDayType) => void }) {
  return (
    <View style={styles.dayTypeRow}>
      {(["workout", "rest"] as ProgramDayType[]).map((t) => (
        <Pressable
          key={t}
          onPress={() => onChange(t)}
          style={[styles.dayTypeChip, value === t && styles.dayTypeChipActive]}
        >
          <Text style={[styles.dayTypeChipText, value === t && styles.dayTypeChipTextActive]}>
            {t === "workout" ? "Workout" : "Rest"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SetTypeChips({ value, onChange }: { value: WorkoutSetType; onChange: (v: WorkoutSetType) => void }) {
  return (
    <View style={styles.setTypeRow}>
      {SET_TYPE_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.setTypeChip, value === opt.value && styles.setTypeChipActive]}
        >
          <Text style={[styles.setTypeChipText, value === opt.value && styles.setTypeChipTextActive]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function StaffProgramBuilderScreen() {
  const router = useRouter();
  const { userId, programId } = useLocalSearchParams<{ userId: string; programId?: string }>();
  const { data: programs, isLoading } = useStaffPrograms(userId);
  const { data: workoutsData } = useWorkouts();
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const deleteProgram = useDeleteProgram();

  const existing = programId ? programs?.find((p) => p.id === programId) : undefined;
  const isEditing = !!existing;

  const [name, setName] = useState("");
  const [days, setDays] = useState<DayRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || isLoading) return;
    if (existing) {
      setName(existing.name);
      setDays(programToRows(existing));
    } else if (!programId) {
      setDays([newDayRow(0)]);
    }
    setHydrated(true);
  }, [existing, hydrated, isLoading, programId]);

  function updateDay(key: string, patch: Partial<Omit<DayRow, "key">>) {
    setDays((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removeDay(key: string) {
    setDays((prev) => prev.filter((d) => d.key !== key));
  }
  function updateExercise(dayKey: string, exKey: string, patch: Partial<Omit<ExerciseRow, "key">>) {
    setDays((prev) =>
      prev.map((d) =>
        d.key === dayKey
          ? { ...d, exercises: d.exercises.map((e) => (e.key === exKey ? { ...e, ...patch } : e)) }
          : d
      )
    );
  }
  function removeExercise(dayKey: string, exKey: string) {
    setDays((prev) =>
      prev.map((d) => (d.key === dayKey ? { ...d, exercises: d.exercises.filter((e) => e.key !== exKey) } : d))
    );
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Program name is required.");
      return;
    }
    if (days.length === 0) {
      setError("Add at least one day.");
      return;
    }

    const daysPayload = rowsToDays(days);

    try {
      if (isEditing && existing) {
        await updateProgram.mutateAsync({
          id: existing.id,
          userId,
          name: name.trim(),
          days: daysPayload,
          status: existing.status,
        });
      } else {
        await createProgram.mutateAsync({ userId, name: name.trim(), days: daysPayload });
      }
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the program. Please try again.");
    }
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert("Delete program?", `This removes "${existing.name}" for this member. This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProgram.mutateAsync({ id: existing.id, userId });
          tapFeedback();
          router.back();
        },
      },
    ]);
  }

  const saving = createProgram.isPending || updateProgram.isPending;

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? "Edit Program" : "Assign Program"}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextField label="Program name" value={name} onChangeText={setName} placeholder="e.g. Hypertrophy Block 1" />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>DAYS</Text>
            <Pressable onPress={() => setDays((prev) => [...prev, newDayRow(prev.length)])} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Day</Text>
            </Pressable>
          </View>

          {days.map((day, dayIdx) => (
            <Card key={day.key} style={styles.dayCard}>
              <View style={styles.entryHeader}>
                <TextInput
                  value={day.label}
                  onChangeText={(v) => updateDay(day.key, { label: v })}
                  placeholder="e.g. Workout A"
                  placeholderTextColor={Color.textFaint}
                  style={styles.dayLabelInput}
                />
                <Pressable onPress={() => removeDay(day.key)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>

              <DayTypeToggle value={day.type} onChange={(v) => updateDay(day.key, { type: v })} />

              {day.type === "workout" ? (
                <View style={{ marginTop: Spacing.md }}>
                  {day.exercises.map((ex, exIdx) => (
                    <Card key={ex.key} style={styles.exerciseCard}>
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryLabel}>Exercise {exIdx + 1}</Text>
                        <Pressable onPress={() => removeExercise(day.key, ex.key)}>
                          <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                      </View>

                      <Text style={styles.fieldLabel}>Superset (opt.)</Text>
                      <SupersetChips
                        value={ex.supersetGroup}
                        allGroups={day.exercises.map((e) => e.supersetGroup)}
                        onChange={(v) => updateExercise(day.key, ex.key, { supersetGroup: v })}
                      />

                      <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Exercise name</Text>
                      <ExerciseAutocomplete
                        exercises={workoutsData?.exerciseLibrary ?? []}
                        libraryNames={libraryIndex?.items ?? []}
                        value={ex.name}
                        onChange={(exName, exerciseId) => updateExercise(day.key, ex.key, { name: exName, exerciseId })}
                      />

                      <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Muscle tags (comma separated)</Text>
                      <TextInput
                        value={ex.muscleTags}
                        onChangeText={(v) => updateExercise(day.key, ex.key, { muscleTags: v })}
                        placeholder="e.g. Chest, Triceps"
                        placeholderTextColor={Color.textFaint}
                        style={styles.smallInput}
                      />

                      <View style={styles.gridRow}>
                        <View style={styles.numberField}>
                          <Text style={styles.fieldLabel}>Target sets</Text>
                          <TextInput
                            value={ex.targetSets}
                            onChangeText={(v) => updateExercise(day.key, ex.key, { targetSets: v })}
                            keyboardType="number-pad"
                            placeholder="e.g. 4"
                            placeholderTextColor={Color.textFaint}
                            style={styles.smallInput}
                          />
                        </View>
                        <View style={styles.numberField}>
                          <Text style={styles.fieldLabel}>Target reps</Text>
                          <TextInput
                            value={ex.targetReps}
                            onChangeText={(v) => updateExercise(day.key, ex.key, { targetReps: v })}
                            placeholder="e.g. 8-10"
                            placeholderTextColor={Color.textFaint}
                            style={styles.smallInput}
                          />
                        </View>
                      </View>
                      <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Target weight / guidance (optional)</Text>
                      <TextInput
                        value={ex.targetWeight}
                        onChangeText={(v) => updateExercise(day.key, ex.key, { targetWeight: v })}
                        placeholder="e.g. 60kg or RPE 8"
                        placeholderTextColor={Color.textFaint}
                        style={styles.smallInput}
                      />

                      <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Set type</Text>
                      <SetTypeChips value={ex.setType} onChange={(v) => updateExercise(day.key, ex.key, { setType: v })} />

                      <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Coaching notes (optional)</Text>
                      <TextInput
                        value={ex.notes}
                        onChangeText={(v) => updateExercise(day.key, ex.key, { notes: v })}
                        placeholder="e.g. Control the eccentric"
                        placeholderTextColor={Color.textFaint}
                        style={styles.smallInput}
                      />
                    </Card>
                  ))}

                  <Pressable
                    onPress={() => updateDay(day.key, { exercises: [...day.exercises, newExerciseRow()] })}
                    style={styles.addExerciseChip}
                  >
                    <Text style={styles.addChipText}>+ Exercise</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.restHint}>Rest day — no exercises.</Text>
              )}
            </Card>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title={isEditing ? "Save changes" : "Assign program"} onPress={handleSave} loading={saving} style={{ marginTop: Spacing.lg }} />

          {isEditing ? (
            <Pressable onPress={handleDelete} style={styles.deleteRow}>
              <Text style={styles.deleteText}>Delete program</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  addChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  addExerciseChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  dayCard: { padding: Spacing.md, marginBottom: Spacing.md },
  dayLabelInput: { flex: 1, fontSize: 15, fontWeight: "700", color: Color.textPrimary, paddingVertical: 2 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  entryLabel: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  removeText: { fontSize: 12, color: Color.danger },
  dayTypeRow: { flexDirection: "row", gap: Spacing.xs },
  dayTypeChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  dayTypeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  dayTypeChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  dayTypeChipTextActive: { color: Color.gold },
  exerciseCard: { padding: Spacing.md, marginBottom: Spacing.sm, backgroundColor: Color.surface2 },
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
  setTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  setTypeChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  setTypeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  setTypeChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  setTypeChipTextActive: { color: Color.gold },
  restHint: { fontSize: 12, color: Color.textMuted, fontStyle: "italic" },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
  deleteRow: { alignItems: "center", marginTop: Spacing.lg, paddingVertical: Spacing.sm },
  deleteText: { fontSize: 13, color: Color.danger, fontWeight: "600" },
});
