import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { Button } from "@/components/ui/Button";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { TextField } from "@/components/ui/TextField";
import { TimeWheelPicker } from "@/components/ui/TimeWheelPicker";
import { ExerciseEditCard } from "@/components/workout/ExerciseEditCard";
import { useLogStyles } from "@/components/workout/log-styles";
import { WorkoutBlock } from "@/components/workout/WorkoutBlock";
import { Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { personalMuscleSections } from "@/lib/exercise-muscles";
import { entryBlocks, orderedEntries } from "@/lib/entry-order";
import { tapFeedback, selectionFeedback, warningFeedback } from "@/lib/haptics";
import { findExerciseLibrarySlug, useExerciseLibraryNameIndex } from "@/lib/queries/exercise-library";
import { useCreateWorkoutTemplate, useDeleteWorkoutTemplate, useUpdateWorkoutTemplate, useWorkoutTemplates } from "@/lib/queries/workout-templates";
import { useProfile } from "@/lib/queries/profile";
import { useWorkouts, type ExerciseSection } from "@/lib/queries/workouts";
import { supersetLetter, supersetMemberLabel } from "@/lib/superset-label";
import { groupExerciseRowsBySuperset, supersetColor } from "@/lib/superset-groups";
import { cleanLonelySupersets, tapSupersetLabel, ungroupAll } from "@/lib/superset-select";
import { addRound, removeLastRound } from "@/lib/superset-rounds";
import { newSetRow, newTemplateRow, rowsToTemplate, templateToRows, type TemplateRow } from "@/lib/template-rows";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { applyWeightFrom, normalizeWeights, sanitizeWeight, weightUnitFor } from "@/lib/weight-input";
import { getPersonalExerciseNames } from "@/lib/workout-formatters";
import { takePendingWorkoutTemplateSeed } from "@/lib/workout-template-seed";
import type { SetRow } from "@/lib/workout-draft";

// Build or edit a workout template with the same cards as a live workout: the focused view (one round or set at a time, with "Edit" for the full details of each
// exercise) and the full exercise card. Nothing here is live: no ticks, no rest timer, no previous numbers. Reached from "Save to my templates" (which hands over
// a ready-filled workout), from the Workouts library, and to edit a saved template.
const NO_RUNS: never[] = [];
const noop = () => {};

export default function WorkoutTemplateBuilderScreen() {
  const styles = useStyles();
  const logStyles = useLogStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { data: templates, isLoading } = useWorkoutTemplates();
  const { data: workoutsData } = useWorkouts();
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const { data: profile } = useProfile();
  const createTemplate = useCreateWorkoutTemplate();
  const updateTemplate = useUpdateWorkoutTemplate();
  const deleteTemplate = useDeleteWorkoutTemplate();
  const weightUnit = weightUnitFor(profile?.preferredUnits);

  const existing = templateId ? templates?.find((t) => t.id === templateId) : undefined;
  const isEditing = !!existing;

  const [name, setName] = useState("");
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Exercises open in their full card (a new one stays open while its name is typed) and supersets switched to their full cards.
  const [openRows, setOpenRows] = useState<string[]>([]);
  const [editingGroups, setEditingGroups] = useState<string[]>([]);
  const [focusedWeightKey, setFocusedWeightKey] = useState<string | null>(null);
  const [timePickerTarget, setTimePickerTarget] = useState<{ rowKey: string; setKey: string; secs: number } | null>(null);

  useEffect(() => {
    if (hydrated || isLoading) return;
    if (existing) {
      setName(existing.name);
      setRows(templateToRows(existing.exercises));
    } else if (!templateId) {
      // "Save to my templates" hands its exercises over this way, not through a route parameter: a read-once in-memory value, so it only applies on this first,
      // fresh visit.
      const seed = takePendingWorkoutTemplateSeed();
      if (seed) {
        setName(seed.name);
        setRows(seed.exercises.length > 0 ? templateToRows(seed.exercises) : [newTemplateRow()]);
      } else {
        const first = newTemplateRow();
        setRows([first]);
        setOpenRows([first.key]);
      }
    }
    setHydrated(true);
  }, [existing, hydrated, isLoading, templateId]);

  // ── what the cards need to know about the member's own exercises
  const knownNames = useMemo(
    () => new Set([...(workoutsData?.exerciseLibrary ?? []), ...(libraryIndex?.items ?? [])].map((e) => e.name.trim().toLowerCase())),
    [workoutsData?.exerciseLibrary, libraryIndex?.items]
  );
  const rememberedSections = useMemo(() => personalMuscleSections(workoutsData?.sessions ?? []), [workoutsData?.sessions]);
  const personalNames = useMemo(
    () => getPersonalExerciseNames(workoutsData?.sessions ?? [], workoutsData?.exerciseLibrary ?? [], libraryIndex?.items ?? []),
    [workoutsData?.sessions, workoutsData?.exerciseLibrary, libraryIndex?.items]
  );
  const isOwnExercise = (r: { name: string; exerciseId: string | null }) => !!r.name.trim() && !r.exerciseId && !knownNames.has(r.name.trim().toLowerCase());
  const ownSectionFor = (r: TemplateRow): ExerciseSection | null => (isOwnExercise(r) ? r.muscleSection ?? rememberedSections.get(r.name.trim().toLowerCase()) ?? null : null);

  // ── editing the rows (the same moves as the logging screen, without anything live)
  function updateRow(key: string, patch: Partial<Omit<TemplateRow, "key">>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function mapRow(key: string, fn: (r: TemplateRow) => TemplateRow) {
    setRows((prev) => prev.map((r) => (r.key === key ? fn(r) : r)));
  }
  function updateSetRow(rowKey: string, setKey: string, patch: Partial<Omit<SetRow, "key">>) {
    mapRow(rowKey, (r) => ({ ...r, setRows: r.setRows.map((sr) => (sr.key === setKey ? { ...sr, ...patch } : sr)) }));
  }
  // A change to one set carries down to the sets below it, never to the ones above.
  function changeSetCarry(rowKey: string, setKey: string, patch: Partial<Omit<SetRow, "key">>) {
    const carried: Partial<Omit<SetRow, "key">> = {};
    for (const k of ["weight", "reps", "repsRight", "repsLeft"] as const) if (patch[k] !== undefined) carried[k] = patch[k];
    mapRow(rowKey, (r) => {
      const at = r.setRows.findIndex((sr) => sr.key === setKey);
      if (at === -1) return r;
      return { ...r, setRows: r.setRows.map((sr, i) => (i < at ? sr : i === at ? { ...sr, ...patch } : { ...sr, ...carried })) };
    });
  }
  function updateFirstSetField(rowKey: string, setKey: string, field: "weight" | "reps" | "repsRight" | "repsLeft", value: string) {
    mapRow(rowKey, (r) => {
      const at = r.setRows.findIndex((sr) => sr.key === setKey);
      return { ...r, setRows: r.setRows.map((sr, idx) => (idx >= at && at !== -1 ? { ...sr, [field]: value } : sr)) };
    });
  }
  function typeWeight(rowKey: string, setKey: string, text: string) {
    const value = sanitizeWeight(text);
    mapRow(rowKey, (r) => ({ ...r, setRows: applyWeightFrom(r.setRows, setKey, value) }));
  }
  function finishWeight(rowKey: string) {
    setFocusedWeightKey(null);
    mapRow(rowKey, (r) => (r.unitMode === "weight" ? { ...r, setRows: normalizeWeights(r.setRows, weightUnit) } : r));
  }
  function addSetRow(rowKey: string) {
    tapFeedback();
    mapRow(rowKey, (r) => ({ ...r, setRows: [...r.setRows, newSetRow(r.defaultSetType)] }));
  }
  function removeSetRow(rowKey: string, setKey: string) {
    tapFeedback();
    mapRow(rowKey, (r) => ({ ...r, setRows: r.setRows.filter((sr) => sr.key !== setKey) }));
  }
  // kg, time and band each keep their own typed values per set, so switching away and back loses nothing.
  function changeUnitMode(row: TemplateRow, mode: TemplateRow["unitMode"]) {
    if (row.unitMode === mode) return;
    updateRow(row.key, {
      unitMode: mode,
      setRows: row.setRows.map((sr) => {
        const saved = { ...(sr.modeValues ?? {}), [row.unitMode]: sr.weight };
        return { ...sr, modeValues: saved, weight: saved[mode] ?? "" };
      }),
    });
  }
  function cycleUnitMode(rowKey: string) {
    const row = rows.find((r) => r.key === rowKey);
    if (!row) return;
    selectionFeedback();
    changeUnitMode(row, row.unitMode === "weight" ? "time" : row.unitMode === "time" ? "band" : "weight");
  }
  function toggleSplitReps(row: TemplateRow) {
    selectionFeedback();
    updateRow(row.key, { perSide: !row.perSide });
  }
  function cycleSuperset(row: { key: string }) {
    const next = tapSupersetLabel(rows, NO_RUNS, row.key);
    if (!next) {
      warningFeedback();
      return;
    }
    selectionFeedback();
    setRows(next.exerciseRows as TemplateRow[]);
  }
  function ungroupSuperset(label: string) {
    Alert.alert("Ungroup this superset?", "The exercises stay in the workout but are no longer done back to back.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Ungroup",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          setRows(ungroupAll(rows, NO_RUNS, label).exerciseRows as TemplateRow[]);
        },
      },
    ]);
  }
  function removeRow(key: string) {
    Alert.alert("Remove this exercise?", "It will be taken out of the workout.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          setRows((prev) => prev.filter((r) => r.key !== key));
        },
      },
    ]);
  }
  function addExercise() {
    tapFeedback();
    const added = newTemplateRow();
    setRows((prev) => [...prev, added]);
    setOpenRows((prev) => [...prev, added.key]);
  }
  function replaceGroupRows(label: string, next: TemplateRow[]) {
    const byKey = new Map(next.map((r) => [r.key, r]));
    setRows((prev) => prev.map((r) => (r.supersetGroup === label ? byKey.get(r.key) ?? r : r)));
  }
  function toggleEditGroup(label: string) {
    tapFeedback();
    setEditingGroups((prev) => (prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]));
  }

  // ── saving
  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Give this workout a name.");
      return;
    }
    const payload = rowsToTemplate(cleanLonelySupersets(rows, NO_RUNS).exerciseRows as TemplateRow[]);
    if (payload.length === 0) {
      setError("Add at least one exercise.");
      return;
    }
    try {
      if (isEditing && existing) await updateTemplate.mutateAsync({ id: existing.id, name: name.trim(), exercises: payload });
      else await createTemplate.mutateAsync({ name: name.trim(), exercises: payload });
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this workout. Please try again.");
    }
  }

  function handleArchive() {
    if (!existing) return;
    Alert.alert("Archive workout?", `"${existing.name}" moves to your Archive. You can restore it any time.`, [
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

  // ── drawing the cards
  const allGroupLabels = orderedEntries(rows, NO_RUNS).map((e) => e.row.supersetGroup ?? null);
  const memberNumber = (key: string): number => {
    const row = rows.find((r) => r.key === key);
    if (!row?.supersetGroup) return 0;
    return rows.filter((r) => r.supersetGroup === row.supersetGroup).findIndex((r) => r.key === key);
  };
  const exerciseNumber = (key: string): number => rows.findIndex((r) => r.key === key) + 1;

  const renderGroup = (grp: { group: string | null; rows: TemplateRow[] }) => {
    const isSuper = !!grp.group && grp.rows.length > 1;
    const blockKey = isSuper ? `g-${grp.group}` : `s-${grp.rows[0].key}`;
    const colour = grp.group ? supersetColor(grp.group, allGroupLabels) : "#9FB3D1";
    const unnamed = grp.rows.some((r) => !r.name.trim());
    const editing = editingGroups.includes(blockKey) || unnamed || grp.rows.some((r) => openRows.includes(r.key));
    const labels = grp.rows.map((r, k) => (grp.group ? supersetMemberLabel(grp.group, allGroupLabels, memberNumber(r.key)) : String(exerciseNumber(r.key) || k + 1)));
    const isGrouped = grp.rows.length > 1;
    return (
      <WorkoutBlock
        key={blockKey}
        colour={colour}
        headerText={isSuper && grp.group ? `Superset ${supersetLetter(grp.group, allGroupLabels)} · ${grp.rows.length} exercises` : `Exercise ${labels[0]}`}
        editing={editing}
        showToggle={!unnamed}
        toggleLabel={editing ? "Focused view" : isSuper ? "Edit exercises" : "Edit"}
        toggleHint={editing ? "Back to the focused view" : "Edit the details"}
        onToggle={() => {
          if (editing) {
            tapFeedback();
            setEditingGroups((prev) => prev.filter((g) => g !== blockKey));
            setOpenRows((prev) => prev.filter((k) => !grp.rows.some((r) => r.key === k)));
          } else {
            toggleEditGroup(blockKey);
          }
        }}
        onUngroup={isSuper && grp.group ? () => ungroupSuperset(grp.group as string) : undefined}
        fullCards={grp.rows.map((row, memberIdx) => {
          const idx = rows.indexOf(row);
          return (
            <ExerciseEditCard
              key={row.key}
              mode="template"
              row={row}
              index={idx}
              grouped={isGrouped}
              dividerBefore={isGrouped && memberIdx > 0}
              badge={{
                text: row.supersetGroup ? supersetMemberLabel(row.supersetGroup, allGroupLabels, memberNumber(row.key)) : String(idx + 1),
                color: row.supersetGroup ? supersetColor(row.supersetGroup, allGroupLabels) : null,
                a11y: row.supersetGroup
                  ? `Exercise ${idx + 1}, in superset ${supersetLetter(row.supersetGroup, allGroupLabels)}. Tap to change.`
                  : `Exercise ${idx + 1}. Tap to put it in a superset.`,
              }}
              allComplete={false}
              last={null}
              weightUnit={weightUnit}
              focusedWeightKey={focusedWeightKey}
              setFocusedWeightKey={setFocusedWeightKey}
              exercises={workoutsData?.exerciseLibrary ?? []}
              libraryNames={libraryIndex?.items ?? []}
              personalNames={personalNames}
              bodyPart={libraryIndex && isOwnExercise(row) ? { section: ownSectionFor(row), remembered: !row.muscleSection && !!ownSectionFor(row) } : null}
              demoSlug={libraryIndex ? findExerciseLibrarySlug(row.name, libraryIndex) : null}
              onOpenDemo={(slug) => router.push({ pathname: "/exercise-demo" as never, params: { slug } })}
              onOpenPlateCalculator={noop}
              onOpenRestTimer={noop}
              onCycleSuperset={cycleSuperset}
              onRemove={removeRow}
              updateRow={updateRow}
              updateSetRow={updateSetRow}
              updateFirstSetField={updateFirstSetField}
              typeWeight={typeWeight}
              finishWeight={finishWeight}
              changeUnitMode={changeUnitMode}
              toggleSplitReps={toggleSplitReps}
              addSetRow={addSetRow}
              removeSetRow={removeSetRow}
              onToggleSetComplete={noop}
              onStartSetTimer={noop}
              onPickTime={(setKey, secs) => setTimePickerTarget({ rowKey: row.key, setKey, secs })}
            />
          );
        })}
        rounds={{
          mode: "template",
          members: grp.rows.map((r) => ({ kind: "exercise" as const, row: r })),
          labels,
          color: colour,
          roundWord: grp.group ? "Round" : "Set",
          weightUnit,
          onChangeSet: changeSetCarry,
          onToggleSet: noop,
          onAddRound: () => {
            tapFeedback();
            if (grp.group) replaceGroupRows(grp.group, addRound(grp.rows, (r) => newSetRow(r.defaultSetType)));
            else addSetRow(grp.rows[0].key);
          },
          onRemoveRound: () => {
            tapFeedback();
            if (grp.group) replaceGroupRows(grp.group, removeLastRound(grp.rows));
            else if (grp.rows[0].setRows.length > 1) removeSetRow(grp.rows[0].key, grp.rows[0].setRows[grp.rows[0].setRows.length - 1].key);
          },
          onPickTime: (rowKey, setKey, secs) => setTimePickerTarget({ rowKey, setKey, secs: secs ?? 90 }),
          onStartTimer: noop,
          onCycleUnit: cycleUnitMode,
          onToggleSplit: (rowKey) => {
            const row = rows.find((r) => r.key === rowKey);
            if (row) toggleSplitReps(row);
          },
          onCycleSuperset: (key) => cycleSuperset({ key }),
          onChangeRun: noop,
          onPickRunTime: noop,
          onToggleRun: noop,
          onOpenRunTimer: noop,
        }}
      />
    );
  };

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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? "Edit template" : "New template"}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
        <TextField label="Template name" value={name} onChangeText={setName} placeholder="e.g. Upper Body A" />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Exercises</Text>
        </View>
        {rows.length >= 2 && !rows.some((r) => r.supersetGroup) ? (
          <Text style={styles.hint}>Tip: tap an exercise&apos;s number to link it with the one above and make a superset.</Text>
        ) : null}

        {entryBlocks(rows, NO_RUNS).map((blk) => (blk.kind === "exercise" ? groupExerciseRowsBySuperset(blk.rows).map(renderGroup) : null))}

        <View style={styles.addRow}>
          <Pressable onPress={addExercise} style={logStyles.addChip} accessibilityRole="button">
            <Ionicons name="barbell-outline" size={18} color={Color.textPrimary} />
            <Text style={logStyles.addChipText}>Add exercise</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={isEditing ? "Save changes" : "Save template"} onPress={handleSave} loading={saving} style={{ marginTop: Spacing.lg }} />

        {isEditing ? (
          <>
            <Pressable onPress={handleArchive} style={styles.secondaryRow}>
              <Text style={styles.secondaryRowText}>Archive template</Text>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.secondaryRow}>
              <Text style={styles.deleteText}>Delete permanently</Text>
            </Pressable>
          </>
        ) : null}
      </KeyboardAwareScroll>

      <Modal visible={timePickerTarget !== null} transparent animationType="fade" onRequestClose={() => setTimePickerTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTimePickerTarget(null)}>
          <BlurBackdrop />
          <View style={logStyles.timePickerCard} onStartShouldSetResponder={() => true}>
            <Text style={logStyles.timePickerTitle}>Set duration</Text>
            {timePickerTarget ? (
              <TimeWheelPicker totalSecs={timePickerTarget.secs} onChange={(secs) => setTimePickerTarget((prev) => (prev ? { ...prev, secs } : prev))} />
            ) : null}
            <Button
              title="Done"
              onPress={() => {
                if (timePickerTarget) {
                  const m = Math.floor(timePickerTarget.secs / 60);
                  const s = timePickerTarget.secs % 60;
                  updateFirstSetField(timePickerTarget.rowKey, timePickerTarget.setKey, "weight", `${m}:${String(s).padStart(2, "0")}`);
                }
                setTimePickerTarget(null);
              }}
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm, marginBottom: Spacing.sm },
    sectionLabel: { fontSize: 19, fontWeight: "600", color: Color.textPrimary },
    hint: { fontSize: 13, color: Color.textMuted, marginBottom: Spacing.sm },
    addRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    error: { color: Color.danger, fontSize: 14, marginTop: Spacing.md },
    secondaryRow: { alignItems: "center", paddingVertical: Spacing.md },
    secondaryRowText: { fontSize: 15, fontWeight: "600", color: Color.textSecondary },
    deleteText: { fontSize: 15, fontWeight: "600", color: Color.danger },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  })
);
