import { Ionicons } from "@expo/vector-icons";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete, type ExerciseLibraryNameEntry } from "@/components/ui/ExerciseAutocomplete";
import { BodyPartPicker } from "@/components/workout/BodyPartPicker";
import { BodyweightButton } from "@/components/workout/BodyweightButton";
import { ExerciseDemoRow, NoteControl, RirControl } from "@/components/workout/exercise-card-parts";
import { useLogStyles as useStyles } from "@/components/workout/log-styles";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { SET_TYPE_OPTIONS, type ExerciseLibraryEntry, type ExerciseSection, type WorkoutSetType } from "@/lib/queries/workouts";
import { useLegacyColors } from "@/lib/theme";
import { getLastSetForIndex, getLastExercisePerformance, parseDuration } from "@/lib/workout-formatters";
import { stripWeightUnit, weightFontSize, withWeightUnit, type WeightUnit } from "@/lib/weight-input";
import type { ExerciseRow, SetRow } from "@/lib/workout-draft";

// The full details of one exercise: its name, body part, unit (kg, time or band), every set with its weight and reps, add and remove a set, reps in reserve and a
// note. This is the card the logging screen and the template editor both show when an exercise is opened for editing ("Edit" on the workout card), so they are
// the same card. `mode` is "log" for a live workout (previous numbers, the tick for each set, rest timer, plate calculator, reps in reserve) or "template" for
// planning one (targets only). Moved here from log-workout.tsx with the JSX unchanged; the logging screen's state stays there and comes in through props.
function unitModeLabel(mode: ExerciseRow["unitMode"]): string {
  if (mode === "time") return "Time unit";
  if (mode === "band") return "Band";
  return "Weight unit";
}

function unitModeColumnLabel(mode: ExerciseRow["unitMode"]): string {
  if (mode === "time") return "Time";
  if (mode === "band") return "Band";
  return "Weight";
}

function nextSetType(current: WorkoutSetType): WorkoutSetType {
  const idx = SET_TYPE_OPTIONS.findIndex((opt) => opt.value === current);
  return SET_TYPE_OPTIONS[(idx + 1) % SET_TYPE_OPTIONS.length].value;
}

// "Last time" for one set, shown beside the inputs (App v2: target next to
// input, so the member never has to scroll up to remember what they did).
function formatPreviousSet(prev: { weight: string | null; reps: number | null } | null, mode: ExerciseRow["unitMode"]): string {
  if (!prev) return "—";
  const w = prev.weight?.trim() || null;
  if (mode === "time") return w ?? "—";
  if (w && prev.reps != null) return `${w.replace(/\s?kg$/i, "")} × ${prev.reps}`;
  if (w) return w;
  if (prev.reps != null) return `${prev.reps} reps`;
  return "—";
}

export type ExerciseEditCardProps = {
  mode: "log" | "template";
  row: ExerciseRow;
  /** Position of the exercise in the workout (for labels). */
  index: number;
  /** True when the card sits inside a superset box (drawn flat, with a divider between members). */
  grouped: boolean;
  dividerBefore: boolean;
  /** The round badge at the left of the header: "3", or "A2" in a superset (with that superset's colour). */
  badge: { text: string; color: string | null; a11y: string };
  allComplete: boolean;
  /** Last time's numbers for this exercise (logging only). */
  last: ReturnType<typeof getLastExercisePerformance> | null | undefined;
  weightUnit: WeightUnit;
  focusedWeightKey: string | null;
  setFocusedWeightKey: (key: string | null) => void;
  exercises: ExerciseLibraryEntry[];
  libraryNames: ExerciseLibraryNameEntry[];
  personalNames: string[];
  /** Set when the exercise is one the member typed themselves: which body part it is (if known) and whether that came from an earlier workout. */
  bodyPart: { section: ExerciseSection | null; remembered: boolean } | null;
  /** The library slug of the exercise, for its demonstration picture. */
  demoSlug: string | null;
  onOpenDemo: (slug: string) => void;
  onOpenPlateCalculator: () => void;
  onOpenRestTimer: () => void;
  onCycleSuperset: (row: ExerciseRow) => void;
  onRemove: (key: string) => void;
  updateRow: (key: string, patch: Partial<Omit<ExerciseRow, "key">>) => void;
  updateSetRow: (rowKey: string, setKey: string, patch: Partial<Omit<SetRow, "key">>) => void;
  updateFirstSetField: (rowKey: string, setKey: string, field: "weight" | "reps" | "repsRight" | "repsLeft", value: string) => void;
  typeWeight: (rowKey: string, setKey: string, text: string) => void;
  finishWeight: (rowKey: string) => void;
  changeUnitMode: (row: ExerciseRow, mode: ExerciseRow["unitMode"]) => void;
  toggleSplitReps: (row: ExerciseRow) => void;
  addSetRow: (rowKey: string) => void;
  removeSetRow: (rowKey: string, setKey: string) => void;
  onToggleSetComplete: (setKey: string) => void;
  /** Bodyweight on or off for a set (and the sets below it): see bodyweightFrom. */
  onToggleBodyweight: (setKey: string) => void;
  onStartSetTimer: (setKey: string) => void;
  onPickTime: (setKey: string, secs: number) => void;
};

export function ExerciseEditCard(props: ExerciseEditCardProps) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const {
    mode,
    row,
    index: idx,
    grouped,
    dividerBefore,
    badge,
    allComplete,
    last,
    weightUnit,
    focusedWeightKey,
    setFocusedWeightKey,
    exercises,
    libraryNames,
    personalNames,
    bodyPart,
    demoSlug,
    onOpenDemo,
    onOpenPlateCalculator,
    onOpenRestTimer,
    onCycleSuperset: cycleSuperset,
    onRemove: removeRow,
    updateRow,
    updateSetRow,
    updateFirstSetField,
    typeWeight,
    finishWeight,
    changeUnitMode,
    toggleSplitReps,
    addSetRow,
    removeSetRow,
    onToggleSetComplete,
    onToggleBodyweight,
    onStartSetTimer,
    onPickTime,
  } = props;
  void idx;
  return (
            <Card style={[grouped ? styles.entryCardGrouped : styles.entryCard, grouped && dividerBefore && styles.entryCardGroupedDivider]}>
      <View style={styles.entryHeader}>
                <View style={styles.entryHeaderTitle}>
                  <Pressable
                    onPress={() => cycleSuperset(row)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={badge.a11y}
                    style={[
                      styles.indexBadge,
                      styles.indexBadgeButton,
                      allComplete && styles.indexBadgeDone,
                      badge.color ? { backgroundColor: badge.color, borderColor: "transparent" } : null,
                    ]}
                  >
                    <Text style={[styles.indexBadgeText, (allComplete || row.supersetGroup) && { color: Color.bg0 }]}>
                      {badge.text}
                    </Text>
                    {!row.supersetGroup ? <Ionicons name="link" size={9} color={Color.textMuted} style={styles.indexBadgeIcon} /> : null}
                  </Pressable>
                  <Text style={styles.entryLabel} numberOfLines={1}>
                    {row.name.trim() || "New exercise"}
                  </Text>
                  {allComplete ? (
                    <View style={styles.exerciseDoneBadge}>
                      <Ionicons name="checkmark" size={12} color={Color.bg0} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.entryHeaderActions}>
                  {mode === "log" ? (
                    <>
                      <Pressable
                        onPress={onOpenPlateCalculator}
                        hitSlop={4}
                        style={styles.roundTool}
                        accessibilityRole="button"
                        accessibilityLabel="Plate calculator"
                      >
                        <Ionicons name="barbell-outline" size={18} color={Color.textPrimary} />
                      </Pressable>
                      <Pressable
                        onPress={onOpenRestTimer}
                        hitSlop={4}
                        style={styles.roundTool}
                        accessibilityRole="button"
                        accessibilityLabel="Rest timer"
                      >
                        <Ionicons name="timer-outline" size={18} color={Color.textPrimary} />
                      </Pressable>
                    </>
                  ) : null}
                  <Pressable
                    onPress={() => removeRow(row.key)}
                    hitSlop={4}
                    style={styles.roundTool}
                    accessibilityRole="button"
                    accessibilityLabel="Remove exercise"
                  >
                    <Ionicons name="trash-outline" size={18} color={Color.danger} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Exercise name</Text>
              <ExerciseAutocomplete
                exercises={exercises}
                libraryNames={libraryNames}
                personalNames={personalNames}
                value={row.name}
                onChange={(name, exerciseId) => updateRow(row.key, { name, exerciseId })}
              />

              {bodyPart ? (
                <BodyPartPicker
                  name={row.name}
                  section={bodyPart.section}
                  remembered={bodyPart.remembered}
                  onPick={(muscleSection) => updateRow(row.key, { muscleSection })}
                />
              ) : null}

              {(() => {
                if (!row.name.trim()) return null;
                const slug = demoSlug;
                if (!slug && !last) return null;
                return <ExerciseDemoRow slug={slug} last={last} onOpenDemo={onOpenDemo} />;
              })()}

              <View style={styles.unitToggleRow}>
                <Text style={styles.fieldLabel}>{unitModeLabel(row.unitMode)}</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Pressable onPress={() => { selectionFeedback(); changeUnitMode(row, "weight"); }} style={[styles.unitChip, row.unitMode === "weight" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "weight" && styles.unitChipTextActive]}>{weightUnit}</Text>
                  </Pressable>
                  <Pressable onPress={() => { selectionFeedback(); changeUnitMode(row, "time"); }} style={[styles.unitChip, row.unitMode === "time" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "time" && styles.unitChipTextActive]}>time</Text>
                  </Pressable>
                  <Pressable onPress={() => { selectionFeedback(); changeUnitMode(row, "band"); }} style={[styles.unitChip, row.unitMode === "band" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "band" && styles.unitChipTextActive]}>band</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.setColumnHeader}>
                <Text style={[styles.setColumnLabel, { width: 46, textAlign: "center" }]}>Set</Text>
                {mode === "log" ? <Text style={[styles.setColumnLabel, { width: 56 }]}>Previous</Text> : null}
                <Text style={[styles.setColumnLabel, { flex: 1, textAlign: "center" }]}>{unitModeColumnLabel(row.unitMode)}</Text>
                {row.unitMode === "time" ? (
                  <Text style={[styles.setColumnLabel, { flex: 1, textAlign: "center" }]} />
                ) : (
                  <Pressable
                    onPress={() => toggleSplitReps(row)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={row.perSide ? "Reps are split into right and left. Tap to use one box." : "Reps. Tap to split into right and left."}
                    style={styles.repsHeaderButton}
                  >
                    <Text style={styles.repsHeaderText}>{row.perSide ? "Reps R | L" : "Reps"}</Text>
                    <Ionicons name={row.perSide ? "remove-circle-outline" : "git-compare-outline"} size={14} color={Color.gold} />
                  </Pressable>
                )}
                <View style={{ width: 40 }} />
              </View>

              {row.setRows.map((set, setIdx) => {
                const lastSet = getLastSetForIndex(last ?? null, setIdx);
                return (
                  <View key={set.key} style={[styles.setRow2, set.completed && styles.setRow2Completed]}>
                    <Pressable
                      onPress={() => {
                        selectionFeedback();
                        updateSetRow(row.key, set.key, { setType: nextSetType(set.setType) });
                      }}
                      style={styles.setNumberWrap}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${setIdx + 1}, ${SET_TYPE_OPTIONS.find((o) => o.value === set.setType)?.label ?? "standard"}. Tap to change set type.`}
                    >
                      <View style={[styles.setNumberBadge, set.completed && styles.setNumberBadgeDone]}>
                        <Text style={styles.setNumber}>{setIdx + 1}</Text>
                      </View>
                      {set.setType !== "standard" ? (
                        <Text style={styles.setTypeTag} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                          {SET_TYPE_OPTIONS.find((o) => o.value === set.setType)?.label}
                        </Text>
                      ) : null}
                    </Pressable>
                    {mode === "log" ? (
                      <Text style={styles.prevCell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {formatPreviousSet(lastSet, row.unitMode)}
                      </Text>
                    ) : null}
                    {row.unitMode === "time" ? (
                      // A wheel picker instead of a keyboard — typing "0:45"
                      // on a phone keypad is fiddly; scrolling two columns
                      // isn't.
                      <Pressable
                        onPress={() => {
                          Keyboard.dismiss();
                          onPickTime(set.key, parseDuration(set.weight) ?? parseDuration(lastSet?.weight ?? "") ?? 90);
                        }}
                        style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1, justifyContent: "center" }]}
                      >
                        <Text style={set.weight ? styles.timePickerValue : styles.timePickerPlaceholder}>
                          {set.weight || lastSet?.weight || "1:30"}
                        </Text>
                      </Pressable>
                    ) : (
                      row.unitMode === "weight" ? (
                        <View style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 4, gap: 2 }]}>
                          <TextInput
                            value={focusedWeightKey === set.key ? stripWeightUnit(set.weight) : withWeightUnit(set.weight, weightUnit)}
                            onChangeText={(v) => typeWeight(row.key, set.key, v)}
                            onFocus={() => setFocusedWeightKey(set.key)}
                            onBlur={() => finishWeight(row.key)}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            placeholder={lastSet?.weight ? stripWeightUnit(lastSet.weight) : "60"}
                            placeholderTextColor={Color.textFaint}
                            accessibilityLabel={`Set ${setIdx + 1} weight in ${weightUnit}`}
                            style={[styles.setInputBare, { fontSize: weightFontSize(focusedWeightKey === set.key ? stripWeightUnit(set.weight) : withWeightUnit(set.weight, weightUnit)) }]}
                          />
                          <BodyweightButton active={set.weight.trim() === "BW"} label={`Set ${setIdx + 1} bodyweight`} onConfirm={() => onToggleBodyweight(set.key)} />
                        </View>
                      ) : (
                        <TextInput
                          value={set.weight}
                          onChangeText={(v) => updateFirstSetField(row.key, set.key, "weight", v)}
                          placeholder="e.g. Purple"
                          placeholderTextColor={Color.textFaint}
                          style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1 }]}
                        />
                      )
                    )}
                    {row.unitMode === "time" ? (
                      mode === "log" ? (
                        // A timed hold/exercise has no rep count — this set's own duration (the field to its left) drives a real countdown, so the member
                        // gets an actual timer instead of self-timing and typing in a guess after the fact.
                        <Pressable onPress={() => onStartSetTimer(set.key)} style={[styles.startTimerButton, { flex: 1 }]}>
                          <Ionicons name="play" size={13} color={Color.goldForeground} />
                          <Text style={styles.startTimerButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Start</Text>
                        </Pressable>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )
                    ) : row.perSide ? (
                      <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
                        <TextInput
                          value={set.repsRight ?? ""}
                          onChangeText={(v) => updateFirstSetField(row.key, set.key, "repsRight", v)}
                          keyboardType="number-pad"
                          placeholder="R"
                          placeholderTextColor={Color.textFaint}
                          style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1 }]}
                        />
                        <TextInput
                          value={set.repsLeft ?? ""}
                          onChangeText={(v) => updateFirstSetField(row.key, set.key, "repsLeft", v)}
                          keyboardType="number-pad"
                          placeholder="L"
                          placeholderTextColor={Color.textFaint}
                          style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1 }]}
                        />
                      </View>
                    ) : (
                      <TextInput
                        value={set.reps}
                        onChangeText={(v) => updateFirstSetField(row.key, set.key, "reps", v)}
                        keyboardType="number-pad"
                        placeholder={lastSet?.reps != null ? String(lastSet.reps) : "8"}
                        placeholderTextColor={Color.textFaint}
                        style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1 }]}
                      />
                    )}
                    {mode === "log" ? (
                      <Pressable
                        onPress={() => onToggleSetComplete(set.key)}
                        hitSlop={6}
                        style={styles.setCheckWrap}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: set.completed }}
                        accessibilityLabel={`Set ${setIdx + 1} done`}
                      >
                        <View style={[styles.setCheck, set.completed && styles.setCheckDone]}>
                          {set.completed ? <Ionicons name="checkmark" size={20} color={Color.bg0} /> : null}
                        </View>
                      </Pressable>
                    ) : (
                      <View style={{ width: 40 }} />
                    )}
                  </View>
                );
              })}

              <View style={styles.setRowActions}>
                <Pressable
                  onPress={() => {
                    tapFeedback();
                    addSetRow(row.key);
                  }}
                  style={styles.setPill}
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={18} color={Color.textPrimary} />
                  <Text style={styles.setPillText}>Add set</Text>
                </Pressable>
                {row.setRows.length > 1 ? (
                  <Pressable
                    onPress={() => removeSetRow(row.key, row.setRows[row.setRows.length - 1].key)}
                    style={[styles.setPill, styles.setPillQuiet]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="remove" size={18} color={Color.textSecondary} />
                    <Text style={[styles.setPillText, { color: Color.textSecondary }]}>Remove last</Text>
                  </Pressable>
                ) : null}
              </View>

              {mode === "log" ? <RirControl value={row.rir} onChange={(v) => updateRow(row.key, { rir: v })} /> : null}
              <NoteControl value={row.notes} onChange={(v) => updateRow(row.key, { notes: v })} />
            </Card>
  );
}
