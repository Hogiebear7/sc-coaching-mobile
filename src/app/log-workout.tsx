import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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
import { DateField } from "@/components/ui/DateField";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { ApiError } from "@/lib/api-client";
import { useAdvanceProgram, useMyProgram } from "@/lib/queries/programs";
import { useWorkoutTemplates } from "@/lib/queries/workout-templates";
import {
  SET_TYPE_OPTIONS,
  useCreateWorkout,
  useWorkouts,
  type CreateWorkoutExerciseInput,
  type CreateWorkoutRunInput,
  type WorkoutSetType,
} from "@/lib/queries/workouts";
import {
  formatAsKg,
  formatAsMmSs,
  formatDuration,
  formatExerciseLoad,
  getLastExercisePerformance,
  getLastSetForIndex,
  livePace,
  parseDuration,
  todayDateString,
} from "@/lib/workout-formatters";
import {
  useWorkoutDraft,
  type CircuitStation,
  type ExerciseRow,
  type RunRow,
  type SetRow,
  type WorkoutFormat,
} from "@/lib/workout-draft";
import type { WorkoutSummaryData } from "@/app/workout-summary";

const FORMAT_OPTIONS: { value: WorkoutFormat; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "chipper", label: "Chipper" },
  { value: "circuit", label: "Circuit" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "tabata", label: "Tabata" },
];

const FORMAT_LABELS: Record<WorkoutFormat, string> = {
  standard: "Standard",
  chipper: "Chipper (for time)",
  circuit: "Circuit",
  amrap: "AMRAP",
  emom: "EMOM",
  tabata: "Tabata",
};

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `${Date.now()}-${keySeq}`;
}

function newSetRow(setType: WorkoutSetType = "standard"): SetRow {
  return { key: nextKey(), weight: "", reps: "", setType, completed: false };
}

function nextSetType(current: WorkoutSetType): WorkoutSetType {
  const idx = SET_TYPE_OPTIONS.findIndex((opt) => opt.value === current);
  return SET_TYPE_OPTIONS[(idx + 1) % SET_TYPE_OPTIONS.length].value;
}

function newExerciseRow(): ExerciseRow {
  return {
    key: nextKey(),
    exerciseId: null,
    name: "",
    notes: "",
    rir: "",
    setRows: [newSetRow(), newSetRow(), newSetRow()],
    unitMode: "weight",
    defaultSetType: "standard",
    supersetWithPrev: false,
  };
}

// Chip row for the exercise's default set type, applied to newly added sets.
function SetTypeChips({ value, onChange }: { value: WorkoutSetType; onChange: (v: WorkoutSetType) => void }) {
  return (
    <View style={styles.setTypeRow}>
      {SET_TYPE_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.setTypeChip, value === opt.value && styles.setTypeChipActive]}
        >
          <Text style={[styles.setTypeChipText, value === opt.value && styles.setTypeChipTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function newRunRow(): RunRow {
  return { key: nextKey(), distance: "", distanceUnit: "km", duration: "", reps: "", sets: "", notes: "", splits: [] };
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

function newCircuitStation(): CircuitStation {
  return { key: nextKey(), name: "", mode: "reps", reps: "", seconds: "" };
}

// Free-text movement list shared by AMRAP/EMOM/Tabata config — a movement is
// just a short label like "10 Burpees", not a full weight/reps/sets row.
function MovementsEditor({ movements, onChange }: { movements: string[]; onChange: (m: string[]) => void }) {
  const [draftText, setDraftText] = useState("");
  function add() {
    const v = draftText.trim();
    if (!v) return;
    onChange([...movements, v]);
    setDraftText("");
  }
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.fieldLabel}>Movements</Text>
      <View style={styles.movementsInputRow}>
        <TextInput
          value={draftText}
          onChangeText={setDraftText}
          placeholder="e.g. 10 Burpees"
          placeholderTextColor={Color.textFaint}
          style={styles.movementsInput}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Pressable onPress={add} style={styles.movementsAddButton}>
          <Ionicons name="add" size={18} color={Color.goldForeground} />
        </Pressable>
      </View>
      {movements.length > 0 ? (
        <View style={styles.movementsList}>
          {movements.map((m, i) => (
            <View key={`${m}-${i}`} style={styles.movementChip}>
              <Text style={styles.movementChipText}>{m}</Text>
              <Pressable onPress={() => onChange(movements.filter((_, idx) => idx !== i))} hitSlop={6}>
                <Ionicons name="close" size={13} color={Color.textFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StationsEditor({ stations, onChange }: { stations: CircuitStation[]; onChange: (s: CircuitStation[]) => void }) {
  function updateStation(key: string, patch: Partial<CircuitStation>) {
    onChange(stations.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  return (
    <View>
      <Text style={styles.fieldLabel}>Stations</Text>
      {stations.map((s, i) => (
        <View key={s.key} style={styles.stationRow}>
          <TextInput
            value={s.name}
            onChangeText={(v) => updateStation(s.key, { name: v })}
            placeholder={`Station ${i + 1} name`}
            placeholderTextColor={Color.textFaint}
            style={styles.stationNameInput}
          />
          <Pressable
            onPress={() => updateStation(s.key, { mode: s.mode === "reps" ? "time" : "reps" })}
            style={styles.stationModeChip}
          >
            <Text style={styles.stationModeText}>{s.mode === "reps" ? "Reps" : "Time"}</Text>
          </Pressable>
          <TextInput
            value={s.mode === "reps" ? s.reps : s.seconds}
            onChangeText={(v) => updateStation(s.key, s.mode === "reps" ? { reps: v } : { seconds: v })}
            keyboardType="number-pad"
            placeholder={s.mode === "reps" ? "reps" : "secs"}
            placeholderTextColor={Color.textFaint}
            style={styles.stationValueInput}
          />
          <Pressable onPress={() => onChange(stations.filter((row) => row.key !== s.key))} hitSlop={6}>
            <Ionicons name="close" size={16} color={Color.textFaint} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...stations, newCircuitStation()])} style={styles.addChip}>
        <Text style={styles.addChipText}>+ Station</Text>
      </Pressable>
    </View>
  );
}

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { programId, dayId, title: initialTitle, date: initialDate, templateId } = useLocalSearchParams<{
    programId?: string;
    dayId?: string;
    title?: string;
    date?: string;
    templateId?: string;
  }>();
  const { data } = useWorkouts();
  const { data: program } = useMyProgram();
  const { data: templates } = useWorkoutTemplates();
  const create = useCreateWorkout();
  const advanceProgram = useAdvanceProgram();

  const { draft, hydrated, update, startTimer, pauseTimer, resetTimer, discard, elapsedSecsNow } = useWorkoutDraft();
  const { title, date, durationMins, notes, exerciseRows, runRows, seeded, isLive } = draft;
  const [error, setError] = useState<string | null>(null);

  // Initialize once, on first arrival with an empty draft — resuming an
  // existing draft (the whole point of persisting it) must NOT be
  // overwritten by whatever params this particular navigation carried.
  useEffect(() => {
    if (!hydrated || draft.date) return;
    const initDate = initialDate ?? todayDateString();
    update({ title: initialTitle ?? "", date: initDate, isLive: initDate === todayDateString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, draft.date]);

  // The displayed clock is driven by this state, refreshed every second
  // while the timer runs — reading elapsedSecsNow() directly in JSX doesn't
  // reliably repaint, since its only dependency the render sees is the tick
  // counter, not the Date.now() call inside it.
  const [liveElapsedSecs, setLiveElapsedSecs] = useState(0);
  useEffect(() => {
    setLiveElapsedSecs(elapsedSecsNow());
    if (!draft.startedAtMs) return;
    const id = setInterval(() => setLiveElapsedSecs(elapsedSecsNow()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.startedAtMs, draft.accumulatedSecs]);

  // Arriving from the Active Program card or a saved Library template —
  // either way prefill exercise rows (name, target sets, set type) from a
  // PrescribedExercise[] so the member only has to fill in what they
  // actually did. Only runs for a genuinely fresh draft (seeded guards it).
  useEffect(() => {
    if (seeded || exerciseRows.length > 0) return;

    const dayExercises = programId && dayId ? program?.days.find((d) => d.id === dayId)?.exercises : undefined;
    const templateExercises = templateId ? templates?.find((t) => t.id === templateId)?.exercises : undefined;
    const source = dayExercises ?? templateExercises;
    if (!source) return;

    const seenGroups = new Set<string>();
    const rows: ExerciseRow[] = source.map((ex) => {
      const supersetWithPrev = ex.supersetGroup ? seenGroups.has(ex.supersetGroup) : false;
      if (ex.supersetGroup) seenGroups.add(ex.supersetGroup);
      const defaultSetType = ex.setType ?? "standard";
      const setRows =
        ex.sets && ex.sets.length > 0
          ? ex.sets.map((s) => newSetRow(s.setType ?? defaultSetType))
          : Array.from({ length: ex.targetSets ?? 3 }, () => newSetRow(defaultSetType));
      return {
        key: nextKey(),
        exerciseId: ex.exerciseId,
        name: ex.name,
        notes: "",
        rir: "",
        setRows,
        unitMode: "weight",
        defaultSetType,
        supersetWithPrev,
      };
    });
    update({ exerciseRows: rows, seeded: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, dayId, program, templateId, templates, seeded, exerciseRows.length]);

  const weightInputRefs = useRef<Record<string, TextInput | null>>({});

  function updateRow(key: string, patch: Partial<Omit<ExerciseRow, "key">>) {
    update({ exerciseRows: exerciseRows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  }
  function removeRow(key: string) {
    Alert.alert("Remove this exercise?", "Any sets you've logged for it will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          update({ exerciseRows: exerciseRows.filter((r) => r.key !== key) });
        },
      },
    ]);
  }
  function updateRunRow(key: string, patch: Partial<Omit<RunRow, "key">>) {
    update({ runRows: runRows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  }
  function removeRunRow(key: string) {
    Alert.alert("Remove this run?", "Any details you've logged for it will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          update({ runRows: runRows.filter((r) => r.key !== key) });
        },
      },
    ]);
  }

  function updateSetRow(rowKey: string, setKey: string, patch: Partial<Omit<SetRow, "key">>) {
    update({
      exerciseRows: exerciseRows.map((r) =>
        r.key === rowKey ? { ...r, setRows: r.setRows.map((sr) => (sr.key === setKey ? { ...sr, ...patch } : sr)) } : r
      ),
    });
  }
  function addSetRow(rowKey: string) {
    tapFeedback();
    update({
      exerciseRows: exerciseRows.map((r) => (r.key === rowKey ? { ...r, setRows: [...r.setRows, newSetRow(r.defaultSetType)] } : r)),
    });
  }
  function removeSetRow(rowKey: string, setKey: string) {
    tapFeedback();
    update({
      exerciseRows: exerciseRows.map((r) => (r.key === rowKey ? { ...r, setRows: r.setRows.filter((sr) => sr.key !== setKey) } : r)),
    });
  }
  function toggleSetComplete(rowKey: string, setKey: string) {
    const row = exerciseRows.find((r) => r.key === rowKey);
    const setIdx = row?.setRows.findIndex((sr) => sr.key === setKey) ?? -1;
    const wasCompleted = row?.setRows[setIdx]?.completed ?? false;

    if (wasCompleted) {
      tapFeedback();
    } else {
      successFeedback();
      const next = row?.setRows[setIdx + 1];
      if (next) {
        setTimeout(() => weightInputRefs.current[next.key]?.focus(), 50);
      }
    }
    updateSetRow(rowKey, setKey, { completed: !wasCompleted });
  }

  function handleDiscard() {
    Alert.alert("Discard this workout?", "Everything you've entered will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          tapFeedback();
          discard();
          router.back();
        },
      },
    ]);
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

    const filledSetsByRow = rowsWithContent.map((r) => r.setRows.filter((sr) => sr.weight.trim() || sr.reps.trim()));

    const exercises: CreateWorkoutExerciseInput[] = rowsWithContent.map((r, idx) => {
      const filled = filledSetsByRow[idx];
      const first = filled[0];
      return {
        exerciseId: r.exerciseId,
        name: r.name.trim(),
        weight: first?.weight.trim() || null,
        reps: first?.reps.trim() ? parseInt(first.reps, 10) : null,
        sets: filled.length || null,
        rir: r.rir.trim() ? parseInt(r.rir, 10) : null,
        setDetails: filled.map((sr) => ({
          weight: sr.weight.trim() || null,
          reps: sr.reps.trim() ? parseInt(sr.reps, 10) : null,
          setType: sr.setType === "standard" ? null : sr.setType,
        })),
        setType: first && first.setType !== "standard" ? first.setType : null,
        supersetGroup: groupByIndex.get(idx) ?? null,
        notes: r.notes.trim() || null,
      };
    });

    const runs: CreateWorkoutRunInput[] = runRows.map((r) => {
      const splitsNote = r.splits.length > 0 ? `Splits: ${r.splits.join(", ")}` : "";
      const combinedNotes = [r.notes.trim(), splitsNote].filter(Boolean).join(" — ");
      return {
        distance: r.distance.trim() ? (r.distanceUnit === "m" ? Math.round((parseFloat(r.distance) / 1000) * 1000) / 1000 : parseFloat(r.distance)) : null,
        durationSecs: parseDuration(r.duration),
        reps: r.reps.trim() ? parseInt(r.reps, 10) : null,
        sets: r.sets.trim() ? parseInt(r.sets, 10) : null,
        notes: combinedNotes || null,
      };
    });

    const liveElapsed = elapsedSecsNow();
    const finalDurationMins = isLive ? (liveElapsed > 0 ? String(Math.round(liveElapsed / 60)) : "") : durationMins.trim();
    const durationLabel = isLive ? formatDuration(liveElapsed) : finalDurationMins ? `${finalDurationMins} min` : "—";

    const formatSummary =
      draft.format !== "standard" && draft.formatResultNote
        ? `${FORMAT_LABELS[draft.format]}: ${draft.formatResultNote}`
        : draft.format !== "standard" && draft.format !== "chipper"
          ? `${FORMAT_LABELS[draft.format]} (not run via the live timer)`
          : "";
    const combinedNotes = [notes.trim(), formatSummary].filter(Boolean).join("\n");

    // Snapshot the summary before the create call — it reads from the
    // form's local state and the personalBests already in memory, so the
    // just-submitted session's highlights compare against the PRE-session
    // record (exactly what "did I just set a PB" should mean).
    const totalVolume = filledSetsByRow.reduce(
      (sum, sets) =>
        sum +
        sets.reduce((s, sr) => {
          const w = sr.weight ? parseFloat(sr.weight) : NaN;
          const reps = sr.reps ? parseInt(sr.reps, 10) : NaN;
          return Number.isFinite(w) && Number.isFinite(reps) ? s + w * reps : s;
        }, 0),
      0
    );
    const totalSets = filledSetsByRow.reduce((sum, sets) => sum + sets.length, 0);
    const completedSets = filledSetsByRow.reduce((sum, sets) => sum + sets.filter((sr) => sr.completed).length, 0);
    const completedExercises = rowsWithContent.filter(
      (r) => r.setRows.length > 0 && r.setRows.every((sr) => sr.completed)
    ).length;
    const exerciseSummaries = rowsWithContent.map((r, idx) => {
      const filled = filledSetsByRow[idx];
      const heaviest = filled.reduce((max, sr) => {
        const w = sr.weight ? parseFloat(sr.weight) : NaN;
        return Number.isFinite(w) && w > max ? w : max;
      }, 0);
      const pb = data?.personalBests.find((p) => p.exerciseName.toLowerCase() === r.name.trim().toLowerCase());
      const isPb = heaviest > 0 && (!pb?.heaviestWeight || heaviest > pb.heaviestWeight.value);
      return {
        name: r.name.trim(),
        setsLogged: filled.length,
        setsCompleted: filled.filter((sr) => sr.completed).length,
        summary: formatExerciseLoad({
          exerciseId: null,
          name: r.name.trim(),
          weight: null,
          reps: null,
          sets: null,
          notes: null,
          setDetails: filled.map((sr) => ({
            weight: sr.weight.trim() || null,
            reps: sr.reps.trim() ? parseInt(sr.reps, 10) : null,
            setType: sr.setType === "standard" ? null : sr.setType,
          })),
        }),
        isPb,
      };
    });
    const summary: WorkoutSummaryData = {
      title: title.trim(),
      date: date.trim(),
      durationLabel,
      totalVolume: Math.round(totalVolume),
      totalSets,
      completedSets,
      totalExercises: rowsWithContent.length,
      completedExercises,
      exercises: exerciseSummaries,
    };

    try {
      await create.mutateAsync({ title: title.trim(), date: date.trim(), durationMins: finalDurationMins, notes: combinedNotes, exercises, runs });
      if (programId) await advanceProgram.mutateAsync(programId);
      successFeedback();
      discard();
      router.replace({ pathname: "/workout-summary", params: { data: JSON.stringify(summary) } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not log workout. Please try again.");
    }
  }

  const timerStarted = draft.accumulatedSecs > 0 || draft.startedAtMs !== null;
  const timerRunning = draft.startedAtMs !== null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Log Workout</Text>
          <Pressable onPress={handleDiscard} hitSlop={12}>
            <Text style={styles.discardText}>Discard</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextField label="Title" value={title} onChangeText={(v) => update({ title: v })} placeholder="e.g. Lower Body Strength" />
          <DateField
            label="Date"
            value={date}
            onChange={(v) => update({ date: v, isLive: v === todayDateString() })}
            maxDate={todayDateString()}
          />

          {isLive ? (
            <View style={styles.timerCard}>
              <View>
                <Text style={styles.timerLabel}>WORKOUT TIME</Text>
                <Text style={styles.timerClock}>{formatDuration(liveElapsedSecs)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                {timerStarted ? (
                  <Pressable
                    onPress={() => {
                      tapFeedback();
                      resetTimer();
                    }}
                    style={styles.timerReset}
                  >
                    <Ionicons name="refresh" size={18} color={Color.textSecondary} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    tapFeedback();
                    if (timerRunning) pauseTimer();
                    else startTimer();
                  }}
                  style={styles.timerToggle}
                >
                  <Ionicons
                    name={timerRunning ? "pause" : "play"}
                    size={20}
                    color={Color.goldForeground}
                  />
                </Pressable>
              </View>
            </View>
          ) : (
            <TextField label="Duration (minutes) — optional" value={durationMins} onChangeText={(v) => update({ durationMins: v })} keyboardType="number-pad" placeholder="e.g. 60" />
          )}
          <TextField
            label="Notes — optional"
            value={notes}
            onChangeText={(v) => update({ notes: v })}
            placeholder="What did you do, how did it feel"
            multiline
            style={styles.multiline}
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>WORKOUT FORMAT</Text>
          </View>
          <View style={styles.formatRow}>
            {FORMAT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  tapFeedback();
                  update({ format: opt.value, formatResultNote: "" });
                }}
                style={[styles.formatChip, draft.format === opt.value && styles.formatChipActive]}
              >
                <Text style={[styles.formatChipText, draft.format === opt.value && styles.formatChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {draft.format === "chipper" ? (
            <Text style={styles.formatHint}>
              List your movements below as exercises and complete them once, for time — the workout clock above is
              your score.
            </Text>
          ) : null}

          {draft.format === "circuit" ? (
            <Card style={styles.entryCard}>
              <StationsEditor
                stations={draft.circuitConfig.stations}
                onChange={(stations) => update({ circuitConfig: { ...draft.circuitConfig, stations } })}
              />
              <View style={styles.formatFieldsRow}>
                <NumberField
                  label="Rest / station (s)"
                  value={draft.circuitConfig.restBetweenStationsSecs}
                  onChangeText={(v) => update({ circuitConfig: { ...draft.circuitConfig, restBetweenStationsSecs: v } })}
                />
                <NumberField
                  label="Rest / round (s)"
                  value={draft.circuitConfig.restBetweenSetsSecs}
                  onChangeText={(v) => update({ circuitConfig: { ...draft.circuitConfig, restBetweenSetsSecs: v } })}
                />
              </View>
              <View style={styles.capModeRow}>
                <Pressable
                  onPress={() => update({ circuitConfig: { ...draft.circuitConfig, capMode: "sets" } })}
                  style={[styles.unitChip, draft.circuitConfig.capMode === "sets" && styles.unitChipActive]}
                >
                  <Text style={[styles.unitChipText, draft.circuitConfig.capMode === "sets" && styles.unitChipTextActive]}>
                    Rounds
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => update({ circuitConfig: { ...draft.circuitConfig, capMode: "time" } })}
                  style={[styles.unitChip, draft.circuitConfig.capMode === "time" && styles.unitChipActive]}
                >
                  <Text style={[styles.unitChipText, draft.circuitConfig.capMode === "time" && styles.unitChipTextActive]}>
                    Time cap
                  </Text>
                </Pressable>
              </View>
              {draft.circuitConfig.capMode === "sets" ? (
                <NumberField
                  label="Total rounds"
                  value={draft.circuitConfig.totalSets}
                  onChangeText={(v) => update({ circuitConfig: { ...draft.circuitConfig, totalSets: v } })}
                />
              ) : (
                <NumberField
                  label="Time cap (mins)"
                  value={draft.circuitConfig.timeCapMins}
                  onChangeText={(v) => update({ circuitConfig: { ...draft.circuitConfig, timeCapMins: v } })}
                />
              )}
              <Button
                title="Start circuit timer"
                variant="secondary"
                onPress={() => router.push({ pathname: "/format-timer" })}
                disabled={draft.circuitConfig.stations.filter((s) => s.name.trim()).length === 0}
                style={{ marginTop: Spacing.md }}
              />
              {draft.formatResultNote ? <Text style={styles.formatResultText}>{draft.formatResultNote}</Text> : null}
            </Card>
          ) : null}

          {draft.format === "amrap" ? (
            <Card style={styles.entryCard}>
              <NumberField
                label="Time cap (mins)"
                value={draft.amrapConfig.timeCapMins}
                onChangeText={(v) => update({ amrapConfig: { ...draft.amrapConfig, timeCapMins: v } })}
              />
              <MovementsEditor
                movements={draft.amrapConfig.movements}
                onChange={(movements) => update({ amrapConfig: { ...draft.amrapConfig, movements } })}
              />
              <Button
                title="Start AMRAP timer"
                variant="secondary"
                onPress={() => router.push({ pathname: "/format-timer" })}
                disabled={draft.amrapConfig.movements.length === 0}
                style={{ marginTop: Spacing.md }}
              />
              {draft.formatResultNote ? <Text style={styles.formatResultText}>{draft.formatResultNote}</Text> : null}
            </Card>
          ) : null}

          {draft.format === "emom" ? (
            <Card style={styles.entryCard}>
              <View style={styles.formatFieldsRow}>
                <NumberField
                  label="Interval (secs)"
                  value={draft.emomConfig.intervalSecs}
                  onChangeText={(v) => update({ emomConfig: { ...draft.emomConfig, intervalSecs: v } })}
                />
                <NumberField
                  label="Total (mins)"
                  value={draft.emomConfig.totalMins}
                  onChangeText={(v) => update({ emomConfig: { ...draft.emomConfig, totalMins: v } })}
                />
              </View>
              <MovementsEditor
                movements={draft.emomConfig.movements}
                onChange={(movements) => update({ emomConfig: { ...draft.emomConfig, movements } })}
              />
              <Button
                title="Start EMOM timer"
                variant="secondary"
                onPress={() => router.push({ pathname: "/format-timer" })}
                disabled={draft.emomConfig.movements.length === 0}
                style={{ marginTop: Spacing.md }}
              />
              {draft.formatResultNote ? <Text style={styles.formatResultText}>{draft.formatResultNote}</Text> : null}
            </Card>
          ) : null}

          {draft.format === "tabata" ? (
            <Card style={styles.entryCard}>
              <View style={styles.formatFieldsRow}>
                <NumberField
                  label="Work (secs)"
                  value={draft.tabataConfig.workSecs}
                  onChangeText={(v) => update({ tabataConfig: { ...draft.tabataConfig, workSecs: v } })}
                />
                <NumberField
                  label="Rest (secs)"
                  value={draft.tabataConfig.restSecs}
                  onChangeText={(v) => update({ tabataConfig: { ...draft.tabataConfig, restSecs: v } })}
                />
                <NumberField
                  label="Rounds"
                  value={draft.tabataConfig.rounds}
                  onChangeText={(v) => update({ tabataConfig: { ...draft.tabataConfig, rounds: v } })}
                />
              </View>
              <MovementsEditor
                movements={draft.tabataConfig.movements}
                onChange={(movements) => update({ tabataConfig: { ...draft.tabataConfig, movements } })}
              />
              <Button
                title="Start Tabata timer"
                variant="secondary"
                onPress={() => router.push({ pathname: "/format-timer" })}
                disabled={draft.tabataConfig.movements.length === 0}
                style={{ marginTop: Spacing.md }}
              />
              {draft.formatResultNote ? <Text style={styles.formatResultText}>{draft.formatResultNote}</Text> : null}
            </Card>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SESSION ENTRIES</Text>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Pressable onPress={() => update({ exerciseRows: [...exerciseRows, newExerciseRow()] })} style={styles.addChip}>
                <Text style={styles.addChipText}>+ Exercise</Text>
              </Pressable>
              <Pressable onPress={() => update({ runRows: [...runRows, newRunRow()] })} style={styles.addChip}>
                <Text style={styles.addChipText}>+ Run</Text>
              </Pressable>
            </View>
          </View>

          {exerciseRows.length === 0 && runRows.length === 0 ? (
            <Text style={styles.emptyHint}>No entries yet. Use the buttons above to log exercises or a run.</Text>
          ) : null}

          {exerciseRows.map((row, idx) => {
            const allComplete = row.setRows.length > 0 && row.setRows.every((sr) => sr.completed);
            const last = getLastExercisePerformance(data?.sessions ?? [], row.name);
            return (
            <Card key={row.key} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={styles.entryHeaderTitle}>
                  <Text style={styles.entryLabel}>Exercise {idx + 1}</Text>
                  {allComplete ? (
                    <View style={styles.exerciseDoneBadge}>
                      <Ionicons name="checkmark" size={12} color={Color.bg0} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.entryHeaderActions}>
                  <Pressable
                    onPress={() => router.push({ pathname: "/plate-calculator" })}
                    hitSlop={8}
                  >
                    <Ionicons name="barbell-outline" size={16} color={Color.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push({ pathname: "/rest-timer", params: { seconds: "90" } })}
                    hitSlop={8}
                  >
                    <Ionicons name="timer-outline" size={16} color={Color.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => removeRow(row.key)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
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

              {last ? (
                <Text style={styles.lastTimeText}>
                  Last time ({last.date}): <Text style={styles.lastTimeValue}>{last.summary}</Text>
                </Text>
              ) : null}

              <View style={styles.unitToggleRow}>
                <Text style={styles.fieldLabel}>{row.unitMode === "time" ? "Time" : "Weight"} unit</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Pressable onPress={() => updateRow(row.key, { unitMode: "weight" })} style={[styles.unitChip, row.unitMode === "weight" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "weight" && styles.unitChipTextActive]}>kg</Text>
                  </Pressable>
                  <Pressable onPress={() => updateRow(row.key, { unitMode: "time" })} style={[styles.unitChip, row.unitMode === "time" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "time" && styles.unitChipTextActive]}>time</Text>
                  </Pressable>
                </View>
              </View>

              {row.unitMode === "time" ? (
                <Pressable
                  onPress={() => router.push({ pathname: "/rest-timer", params: { seconds: "60" } })}
                  style={styles.holdTimerHint}
                >
                  <Ionicons name="hourglass-outline" size={13} color={Color.gold} />
                  <Text style={styles.holdTimerHintText}>Use the countdown timer for holds like planks or wall sits</Text>
                </Pressable>
              ) : null}

              <View style={styles.setColumnHeader}>
                <Text style={[styles.setColumnLabel, { width: 40 }]}>Set</Text>
                <Text style={[styles.setColumnLabel, { flex: 1 }]}>{row.unitMode === "time" ? "Time" : "Weight"}</Text>
                <Text style={[styles.setColumnLabel, { flex: 1 }]}>Reps</Text>
                <View style={{ width: 32 }} />
              </View>

              {row.setRows.map((set, setIdx) => {
                const lastSet = getLastSetForIndex(last, setIdx);
                return (
                  <View key={set.key} style={[styles.setRow2, set.completed && styles.setRow2Completed]}>
                    <Pressable
                      onPress={() => updateSetRow(row.key, set.key, { setType: nextSetType(set.setType) })}
                      style={{ width: 40 }}
                    >
                      <Text style={styles.setNumber}>{setIdx + 1}</Text>
                      {set.setType !== "standard" ? (
                        <Text style={styles.setTypeTag} numberOfLines={1}>
                          {SET_TYPE_OPTIONS.find((o) => o.value === set.setType)?.label}
                        </Text>
                      ) : null}
                    </Pressable>
                    <TextInput
                      ref={(el) => {
                        weightInputRefs.current[set.key] = el;
                      }}
                      value={set.weight}
                      onChangeText={(v) => updateSetRow(row.key, set.key, { weight: v })}
                      onBlur={() => {
                        const formatted = row.unitMode === "time" ? formatAsMmSs(set.weight) : formatAsKg(set.weight);
                        if (formatted !== set.weight) updateSetRow(row.key, set.key, { weight: formatted });
                      }}
                      placeholder={lastSet?.weight ?? (row.unitMode === "time" ? "1:30" : "60")}
                      placeholderTextColor={Color.textFaint}
                      style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1 }]}
                    />
                    <TextInput
                      value={set.reps}
                      onChangeText={(v) => updateSetRow(row.key, set.key, { reps: v })}
                      keyboardType="number-pad"
                      placeholder={lastSet?.reps != null ? String(lastSet.reps) : "8"}
                      placeholderTextColor={Color.textFaint}
                      style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1 }]}
                    />
                    <Pressable onPress={() => toggleSetComplete(row.key, set.key)} hitSlop={8} style={styles.setCheckWrap}>
                      <View style={[styles.setCheck, set.completed && styles.setCheckDone]}>
                        {set.completed ? <Ionicons name="checkmark" size={16} color={Color.bg0} /> : null}
                      </View>
                    </Pressable>
                  </View>
                );
              })}

              <View style={styles.setRowActions}>
                <Pressable onPress={() => addSetRow(row.key)}>
                  <Text style={styles.linkText}>+ Add set</Text>
                </Pressable>
                {row.setRows.length > 1 ? (
                  <Pressable onPress={() => removeSetRow(row.key, row.setRows[row.setRows.length - 1].key)}>
                    <Text style={styles.linkTextMuted}>Remove last set</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Default set type (for new sets)</Text>
              <SetTypeChips value={row.defaultSetType} onChange={(v) => updateRow(row.key, { defaultSetType: v })} />

              <NumberField label="RIR (opt.)" value={row.rir} onChangeText={(v) => updateRow(row.key, { rir: v })} placeholder="e.g. 2" />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Notes (optional)</Text>
              <TextInput
                value={row.notes}
                onChangeText={(v) => updateRow(row.key, { notes: v })}
                placeholder="e.g. Felt strong, could go heavier"
                placeholderTextColor={Color.textFaint}
                style={styles.smallInput}
              />
            </Card>
            );
          })}

          {runRows.map((row, idx) => (
            <Card key={row.key} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryLabel}>Run {idx + 1}</Text>
                <View style={styles.entryHeaderActions}>
                  <Pressable
                    onPress={() => router.push({ pathname: "/run-timer", params: { runKey: row.key } })}
                    hitSlop={8}
                  >
                    <Ionicons name="stopwatch-outline" size={16} color={Color.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => removeRunRow(row.key)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
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

              {row.splits.length > 0 ? (
                <Text style={styles.splitsText}>Splits: {row.splits.join(", ")}</Text>
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
  discardText: { fontSize: 12, fontWeight: "600", color: Color.danger },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  addChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  emptyHint: { fontSize: 12, color: Color.textMuted, borderWidth: 1, borderColor: Color.borderSubtle, borderStyle: "dashed", borderRadius: Radius.md, padding: Spacing.md },
  entryCard: { padding: Spacing.md, marginBottom: Spacing.md },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  entryHeaderTitle: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  entryHeaderActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  entryLabel: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  exerciseDoneBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Color.success,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { fontSize: 12, color: Color.danger },
  lastTimeText: { fontSize: 11, color: Color.textMuted, marginTop: 4 },
  lastTimeValue: { color: Color.textSecondary, fontWeight: "600" },
  timerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  timerLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  timerClock: { fontSize: 24, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"], marginTop: 2 },
  timerToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.gold,
  },
  timerReset: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
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
  holdTimerHint: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.xs },
  holdTimerHintText: { fontSize: 10, color: Color.textMuted, flex: 1 },
  linkText: { fontSize: 12, fontWeight: "600", color: Color.gold, marginTop: Spacing.sm },
  linkTextMuted: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  setColumnHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.md, paddingHorizontal: 2 },
  setColumnLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, color: Color.textFaint, textTransform: "uppercase" },
  setRow2: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    padding: 4,
    borderRadius: Radius.md,
  },
  setRow2Completed: { backgroundColor: Color.successWeak },
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
  setInputCompleted: { borderColor: Color.successWeak, color: Color.textSecondary },
  setCheckWrap: { width: 32, alignItems: "center", justifyContent: "center" },
  setCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Color.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  setCheckDone: { backgroundColor: Color.success, borderColor: Color.success },
  setRowActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm },
  supersetRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  supersetText: { fontSize: 12, color: Color.textMuted },
  supersetTextActive: { color: Color.gold, fontWeight: "600" },
  setTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  setTypeChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  setTypeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  setTypeChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  setTypeChipTextActive: { color: Color.gold },
  unitSwitch: { width: 48, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface2 },
  unitSwitchText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  paceText: { fontSize: 11, color: Color.textMuted, marginTop: Spacing.xs },
  splitsText: { fontSize: 11, color: Color.textSecondary, marginTop: Spacing.xs },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
  formatRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  formatChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  formatChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  formatChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  formatChipTextActive: { color: Color.gold },
  formatHint: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.sm, lineHeight: 17 },
  formatFieldsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  formatResultText: {
    fontSize: 12,
    color: Color.gold,
    fontWeight: "600",
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Color.goldWeak,
  },
  capModeRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  stationRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
  stationNameInput: {
    flex: 1,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  stationModeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle },
  stationModeText: { fontSize: 10, fontWeight: "700", color: Color.textMuted },
  stationValueInput: {
    width: 56,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.xs,
    fontSize: 13,
    color: Color.textPrimary,
    textAlign: "center",
  },
  movementsInputRow: { flexDirection: "row", gap: Spacing.xs },
  movementsInput: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  movementsAddButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.gold,
  },
  movementsList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  movementChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  movementChipText: { fontSize: 11, color: Color.textSecondary, fontWeight: "500" },
});
