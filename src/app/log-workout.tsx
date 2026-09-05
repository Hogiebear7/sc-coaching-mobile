import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  findNodeHandle,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Collapsible } from "@/components/ui/Collapsible";
import { DateField } from "@/components/ui/DateField";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { LogWorkoutTour } from "@/components/ui/LogWorkoutTour";
import { SupersetChips } from "@/components/ui/SupersetChips";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { ApiError } from "@/lib/api-client";
import { useAdvanceProgram, useMyProgram, type PrescribedExercise } from "@/lib/queries/programs";
import {
  findExerciseLibrarySlug,
  pickHeroMedia,
  useExerciseLibraryDetail,
  useExerciseLibraryNameIndex,
} from "@/lib/queries/exercise-library";
import { useProfile } from "@/lib/queries/profile";
import { useRestTimer } from "@/lib/rest-timer";
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
  type AmrapMovement,
  type ChipperMovement,
  type CircuitStation,
  type EmomMovement,
  type ExerciseRow,
  type RunRow,
  type SetRow,
  type WorkoutFormat,
} from "@/lib/workout-draft";
import type { WorkoutSummaryData } from "@/app/workout-summary";
import { setPendingWorkoutSummary } from "@/lib/workout-summary-handoff";
import { setPendingWorkoutTemplateSeed } from "@/lib/workout-template-seed";

const FORMAT_OPTIONS: { value: WorkoutFormat; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "chipper", label: "Chipper" },
  { value: "circuit", label: "Circuit" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "tabata", label: "Tabata" },
];

// Shown live below the format picker so a member who doesn't recognize a
// name (what even is EMOM?) can see what they're choosing before they
// commit to building it out.
const FORMAT_DESCRIPTIONS: Record<WorkoutFormat, string> = {
  standard: "Straight sets — log your weight and reps for each exercise as you go, same as any traditional workout.",
  chipper: "One long list of movements, each with a target. Work through them in order, logging reps or time as you complete each one — the clock keeps running until you're done.",
  circuit: "A set of stations you rotate through, each for a target time or rep count with rest in between, repeated for a set number of rounds.",
  amrap: "As Many Reps (or Rounds) As Possible — set a time cap, then work through your movements for as much output as you can fit in before time's up.",
  emom: "Every Minute On the Minute — start a new movement at the top of each interval. Finish early and the rest of that minute is your rest.",
  tabata: "20 seconds of work, 10 seconds of rest, repeated for a set number of rounds — a short, high-intensity interval format.",
};

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
  return { key: nextKey(), weight: "", reps: "", repsRight: "", repsLeft: "", setType, completed: false };
}

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
    supersetGroup: null,
    perSide: false,
  };
}

// Exercises sharing a superset label render together as one visual block
// (the "ST1"-style grouping from a station-based program layout) instead of
// as separate cards — a row's FIRST appearance decides where its group sits
// in the list; later rows with the same label join that group wherever it
// already is, even if other rows come between them in the raw list.
function groupExerciseRowsBySuperset(rows: ExerciseRow[]): { group: string | null; rows: ExerciseRow[] }[] {
  const groups: { group: string | null; rows: ExerciseRow[] }[] = [];
  const groupIndexByLabel = new Map<string, number>();
  for (const row of rows) {
    if (row.supersetGroup) {
      const existingIdx = groupIndexByLabel.get(row.supersetGroup);
      if (existingIdx !== undefined) {
        groups[existingIdx].rows.push(row);
        continue;
      }
      groupIndexByLabel.set(row.supersetGroup, groups.length);
      groups.push({ group: row.supersetGroup, rows: [row] });
    } else {
      groups.push({ group: null, rows: [row] });
    }
  }
  return groups;
}

function newRunRow(): RunRow {
  return { key: nextKey(), distance: "", distanceUnit: "km", duration: "", reps: "", sets: "", notes: "", splits: [] };
}

// Small demo-image thumbnail beside an exercise row, sourced from the same
// exercise library media the "View demonstration" link and library detail
// screen already use — no separate photo system needed. Renders nothing
// while a name has no library match or its media hasn't loaded, so the row
// layout doesn't jump once it resolves.
function ExerciseThumbnail({ slug }: { slug: string | undefined }) {
  const { data } = useExerciseLibraryDetail(slug ?? "");
  if (!slug) return null;
  const media = data ? pickHeroMedia(data.media) : null;
  if (!media) return null;
  return <Image source={{ uri: media.url }} style={styles.exerciseThumb} resizeMode="cover" />;
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

function newCircuitStation(defaultSeconds?: string): CircuitStation {
  return { key: nextKey(), name: "", seconds: defaultSeconds ?? "30", repTarget: "" };
}

function newEmomMovement(): EmomMovement {
  return { key: nextKey(), name: "", repsOrTime: "" };
}

function newAmrapMovement(): AmrapMovement {
  return { key: nextKey(), name: "", targetReps: "", completedReps: 0 };
}

function newChipperMovement(): ChipperMovement {
  return {
    key: nextKey(),
    name: "",
    mode: "reps",
    targetReps: "",
    targetSeconds: "",
    doneReps: 0,
    doneSeconds: 0,
    timerStartedAtMs: null,
    log: [],
  };
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

// A chipper movement's config: just its name, mode, and target — the same
// shape as the other formats' movement lists. Actual progress (reps/time
// done, with timestamps) is only tracked live on the workout card, not here.
function ChipperMovementRow({
  movement,
  index,
  onChange,
  onRemove,
}: {
  movement: ChipperMovement;
  index: number;
  onChange: (patch: Partial<ChipperMovement>) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.stationRow}>
      <TextInput
        value={movement.name}
        onChangeText={(v) => onChange({ name: v })}
        placeholder={`Movement ${index + 1}, e.g. Squats`}
        placeholderTextColor={Color.textFaint}
        style={[styles.stationNameInput, { flex: 2 }]}
      />
      <Pressable
        onPress={() => onChange({ mode: movement.mode === "reps" ? "time" : "reps" })}
        style={styles.stationModeChip}
      >
        <Text style={styles.stationModeText}>{movement.mode === "reps" ? "Reps" : "Time"}</Text>
      </Pressable>
      {movement.mode === "reps" ? (
        <TextInput
          value={movement.targetReps}
          onChangeText={(v) => onChange({ targetReps: v })}
          keyboardType="number-pad"
          placeholder="reps"
          placeholderTextColor={Color.textFaint}
          style={styles.stationValueInputWide}
        />
      ) : (
        <TextInput
          value={movement.targetSeconds}
          onChangeText={(v) => onChange({ targetSeconds: v })}
          onBlur={() => {
            const formatted = formatAsMmSs(movement.targetSeconds);
            if (formatted !== movement.targetSeconds) onChange({ targetSeconds: formatted });
          }}
          placeholder="5:00"
          placeholderTextColor={Color.textFaint}
          style={styles.stationValueInputWide}
        />
      )}
      <Pressable onPress={onRemove} hitSlop={6}>
        <Ionicons name="close" size={16} color={Color.textFaint} />
      </Pressable>
    </View>
  );
}

function ChipperEditor({ movements, onChange }: { movements: ChipperMovement[]; onChange: (m: ChipperMovement[]) => void }) {
  function update(key: string, patch: Partial<ChipperMovement>) {
    onChange(movements.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }
  function remove(key: string) {
    tapFeedback();
    onChange(movements.filter((m) => m.key !== key));
  }
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.fieldLabel}>Movements</Text>
      {movements.map((m, i) => (
        <ChipperMovementRow key={m.key} movement={m} index={i} onChange={(patch) => update(m.key, patch)} onRemove={() => remove(m.key)} />
      ))}
      <Pressable onPress={() => onChange([...movements, newChipperMovement()])} style={styles.addChip}>
        <Text style={styles.addChipText}>+ Movement</Text>
      </Pressable>
    </View>
  );
}

function StationsEditor({ stations, onChange }: { stations: CircuitStation[]; onChange: (s: CircuitStation[]) => void }) {
  function updateStation(key: string, patch: Partial<CircuitStation>) {
    onChange(stations.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function addStation() {
    // A new station defaults its time to whatever the first station is
    // already set to — most circuits run every station on the same clock,
    // so this saves re-typing it each time; still freely editable after.
    onChange([...stations, newCircuitStation(stations[0]?.seconds)]);
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
          <TextInput
            value={s.seconds}
            onChangeText={(v) => updateStation(s.key, { seconds: v })}
            keyboardType="number-pad"
            placeholder="secs"
            placeholderTextColor={Color.textFaint}
            style={styles.stationValueInput}
          />
          <TextInput
            value={s.repTarget}
            onChangeText={(v) => updateStation(s.key, { repTarget: v })}
            keyboardType="number-pad"
            placeholder="reps (opt.)"
            placeholderTextColor={Color.textFaint}
            style={styles.stationValueInput}
          />
          <Pressable onPress={() => onChange(stations.filter((row) => row.key !== s.key))} hitSlop={6}>
            <Ionicons name="close" size={16} color={Color.textFaint} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addStation} style={styles.addChip}>
        <Text style={styles.addChipText}>+ Station</Text>
      </Pressable>
    </View>
  );
}

function EmomMovementsEditor({ movements, onChange }: { movements: EmomMovement[]; onChange: (m: EmomMovement[]) => void }) {
  function update(key: string, patch: Partial<EmomMovement>) {
    onChange(movements.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.fieldLabel}>Movements</Text>
      {movements.map((m, i) => (
        <View key={m.key} style={styles.stationRow}>
          <TextInput
            value={m.name}
            onChangeText={(v) => update(m.key, { name: v })}
            placeholder={`Movement ${i + 1}, e.g. OH Slams`}
            placeholderTextColor={Color.textFaint}
            style={[styles.stationNameInput, { flex: 2 }]}
          />
          <TextInput
            value={m.repsOrTime}
            onChangeText={(v) => update(m.key, { repsOrTime: v })}
            placeholder="30/30s"
            placeholderTextColor={Color.textFaint}
            style={styles.stationValueInputWide}
          />
          <Pressable onPress={() => onChange(movements.filter((row) => row.key !== m.key))} hitSlop={6}>
            <Ionicons name="close" size={16} color={Color.textFaint} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...movements, newEmomMovement()])} style={styles.addChip}>
        <Text style={styles.addChipText}>+ Movement</Text>
      </Pressable>
    </View>
  );
}

function AmrapMovementsEditor({
  movements,
  subMode,
  onChange,
}: {
  movements: AmrapMovement[];
  subMode: "reps" | "rounds";
  onChange: (m: AmrapMovement[]) => void;
}) {
  function update(key: string, patch: Partial<AmrapMovement>) {
    onChange(movements.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.fieldLabel}>Movements</Text>
      {movements.map((m, i) => (
        <View key={m.key} style={styles.stationRow}>
          <TextInput
            value={m.name}
            onChangeText={(v) => update(m.key, { name: v })}
            placeholder={`Movement ${i + 1}, e.g. Burpees`}
            placeholderTextColor={Color.textFaint}
            style={[styles.stationNameInput, subMode === "reps" && { flex: 2 }]}
          />
          {subMode === "rounds" ? (
            <TextInput
              value={m.targetReps}
              onChangeText={(v) => update(m.key, { targetReps: v })}
              keyboardType="number-pad"
              placeholder="reps/rd"
              placeholderTextColor={Color.textFaint}
              style={styles.stationValueInputWide}
            />
          ) : null}
          <Pressable onPress={() => onChange(movements.filter((row) => row.key !== m.key))} hitSlop={6}>
            <Ionicons name="close" size={16} color={Color.textFaint} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...movements, newAmrapMovement()])} style={styles.addChip}>
        <Text style={styles.addChipText}>+ Movement</Text>
      </Pressable>
    </View>
  );
}

const RPE_DESCRIPTION =
  "Rate of Perceived Exertion — how hard the session felt overall, from 1 (very easy, could do it all day) to 10 (maximal effort, couldn't do another rep).";
const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Shown right after a workout is logged, for every format — feeds the
// eventual workout review and AI report, so it's deliberately quick to fill
// in (tap a number, optional line of text) rather than a long form.
function HowDidYouFeelModal({
  visible,
  rpe,
  onChangeRpe,
  notes,
  onChangeNotes,
  onSkip,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  rpe: number | null;
  onChangeRpe: (v: number | null) => void;
  notes: string;
  onChangeNotes: (v: string) => void;
  onSkip: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <Pressable style={feelStyles.backdrop} onPress={onSkip}>
        <Pressable style={feelStyles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={feelStyles.title}>How did that feel?</Text>
          <Text style={feelStyles.rpeDescription}>{RPE_DESCRIPTION}</Text>
          <View style={feelStyles.rpeRow}>
            {RPE_VALUES.map((v) => (
              <Pressable
                key={v}
                onPress={() => {
                  tapFeedback();
                  onChangeRpe(rpe === v ? null : v);
                }}
                style={[feelStyles.rpeChip, rpe === v && feelStyles.rpeChipActive]}
              >
                <Text style={[feelStyles.rpeChipText, rpe === v && feelStyles.rpeChipTextActive]}>{v}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={onChangeNotes}
            placeholder="Anything worth remembering about this session"
            placeholderTextColor={Color.textFaint}
            style={[styles.multiline, feelStyles.notesInput]}
            multiline
          />
          <View style={feelStyles.actions}>
            <Button title="Skip" variant="secondary" onPress={onSkip} style={{ flex: 1 }} disabled={submitting} />
            <Button title="Log workout" onPress={onSubmit} loading={submitting} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function LogWorkoutScreen() {
  const router = useRouter();
  const {
    programId,
    dayId,
    title: initialTitle,
    date: initialDate,
    templateId,
    addExerciseName,
    generatedExercises: generatedExercisesParam,
    prefillRunTitle,
    prefillRunDurationMins,
    prefillRunDistanceKm,
  } = useLocalSearchParams<{
    programId?: string;
    dayId?: string;
    title?: string;
    date?: string;
    templateId?: string;
    /** From the exercise library's "Add to workout" action — appended to
     *  whatever's already in progress (the draft persists across screens),
     *  not a fresh-seed like programId/templateId above. */
    addExerciseName?: string;
    /** JSON-encoded PrescribedExercise[] from the workout generator — a
     *  fresh-seed source alongside programId/templateId below, not merged
     *  with addExerciseName's append-to-in-progress behavior. */
    generatedExercises?: string;
    /** From Import from Tracker (tracker-import.tsx) — a fresh-seed source
     *  like programId/templateId, adding one prefilled run row rather than
     *  exercise rows. */
    prefillRunTitle?: string;
    prefillRunDurationMins?: string;
    prefillRunDistanceKm?: string;
  }>();
  const { data } = useWorkouts();
  const { data: profile } = useProfile();
  const restTimerSeconds = profile?.restTimerSeconds ?? 90;
  const restTimer = useRestTimer();
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const { data: program } = useMyProgram();
  const { data: templates } = useWorkoutTemplates();
  const create = useCreateWorkout();
  const advanceProgram = useAdvanceProgram();

  const { draft, hydrated, update, startTimer, pauseTimer, resetTimer, discard, elapsedSecsNow } = useWorkoutDraft();
  const { title, date, durationMins, notes, exerciseRows, runRows, isLive } = draft;
  const [error, setError] = useState<string | null>(null);
  const [feelModalOpen, setFeelModalOpen] = useState(false);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [feelingNotes, setFeelingNotes] = useState("");

  // Identifies which fresh-seed source (a specific program day/checkpoint,
  // template, or a just-generated exercise list) this navigation carried —
  // null for a plain blank "Log a workout" start with nothing to seed from.
  const currentSeedSource = programId && dayId
    ? `program:${programId}:${dayId}`
    : templateId
      ? `template:${templateId}`
      : generatedExercisesParam
        ? "generated"
        : null;

  // Initialize once, on first arrival with an empty draft and no seed source
  // — a genuine blank start. Arriving WITH a seed source is handled by the
  // effect below instead, which also covers title/date so a stale leftover
  // draft (draft.date already set from something unrelated) can't silently
  // block a fresh "Start workout"/"Start test" tap from pre-filling.
  useEffect(() => {
    if (!hydrated || draft.date || currentSeedSource) return;
    const initDate = initialDate ?? todayDateString();
    update({ title: initialTitle ?? "", date: initDate, isLive: initDate === todayDateString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, draft.date, currentSeedSource]);

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

  // Set right before a successful submit hands off to workout-summary, so
  // the seed effect below can never re-fire off the post-discard empty
  // draft while this screen is still mid-transition (see the
  // InteractionManager comment in handleSubmit for the full story).
  const hasSubmittedRef = useRef(false);

  // Arriving from the Active Program card (a regular day OR a due test
  // checkpoint — the latter lives in program.testCheckpoints[], not
  // program.days[], so it needs its own lookup), a saved Library template,
  // or the workout generator — all three prefill exercise rows (name,
  // target sets, set type) from a PrescribedExercise[] so the member only
  // has to fill in what they actually did.
  //
  // Keyed off currentSeedSource rather than just "is the draft empty" so
  // this reliably fires every time a *different* day/checkpoint/template is
  // requested (title/date included — see the effect above), while a
  // re-arrival at the SAME source (draft.seededFrom already matches) is
  // left alone, preserving whatever sets the member has already logged.
  useEffect(() => {
    if (hasSubmittedRef.current || !currentSeedSource || draft.seededFrom === currentSeedSource) return;

    const dayExercises =
      programId && dayId
        ? (program?.days.find((d) => d.id === dayId)?.exercises ??
          program?.testCheckpoints?.find((c) => c.day.id === dayId)?.day.exercises)
        : undefined;
    const templateExercises = templateId ? templates?.find((t) => t.id === templateId)?.exercises : undefined;
    let generatedExercisesSource: typeof dayExercises;
    if (generatedExercisesParam) {
      try {
        generatedExercisesSource = JSON.parse(generatedExercisesParam);
      } catch {
        // Malformed/tampered param — fall through to the other sources.
      }
    }
    const source = dayExercises ?? templateExercises ?? generatedExercisesSource;
    // program/templates data may not have loaded yet on the very first
    // render — this effect re-fires once it has, via the deps below, rather
    // than giving up and leaving the draft unseeded.
    if (!source) return;

    const rows: ExerciseRow[] = source.map((ex) => {
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
        supersetGroup: ex.supersetGroup ?? null,
        perSide: false,
      };
    });

    const seedDate = initialDate ?? todayDateString();
    update({
      title: initialTitle ?? "",
      date: seedDate,
      isLive: seedDate === todayDateString(),
      exerciseRows: rows,
      runRows: [],
      accumulatedSecs: 0,
      startedAtMs: null,
      seeded: true,
      seededFrom: currentSeedSource,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeedSource, draft.seededFrom, program, templates, generatedExercisesParam]);

  // "Add to workout" from the exercise library — appends to whatever's
  // already in progress (a ref, not the `seeded` flag above, since this can
  // fire on a draft that's already seeded or mid-edit; it just needs to not
  // re-add the same param value twice across re-renders).
  const consumedAddExerciseName = useRef<string | null>(null);
  useEffect(() => {
    if (!addExerciseName || consumedAddExerciseName.current === addExerciseName) return;
    consumedAddExerciseName.current = addExerciseName;
    update({ exerciseRows: [...exerciseRows, { ...newExerciseRow(), name: addExerciseName }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addExerciseName]);

  // Import from Tracker (tracker-import.tsx) — a fresh-seed source like
  // programId/templateId above, but for a single run row instead of
  // exercise rows. Only fires for a genuinely empty runs list, same
  // once-only spirit as the exercise-seeding effect.
  useEffect(() => {
    if (!hydrated || runRows.length > 0) return;
    if (!prefillRunDurationMins && !prefillRunDistanceKm) return;
    update({
      runRows: [{ ...newRunRow(), duration: prefillRunDurationMins ?? "", distance: prefillRunDistanceKm ?? "" }],
      title: title.trim() ? title : prefillRunTitle ?? title,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, prefillRunTitle, prefillRunDurationMins, prefillRunDistanceKm, runRows.length]);

  const weightInputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollRef = useRef<KeyboardAwareScrollViewRef | null>(null);
  // The "+ Exercise"/"+ Run" row always sits right after the last entry (see
  // render below) — scrolling to bring IT into view is what actually shows
  // the newly-added box above it, without needing a ref per entry.
  const addButtonsRef = useRef<View | null>(null);

  function scrollToAddButtons() {
    const scrollNode = findNodeHandle(scrollRef.current);
    if (!scrollNode) return;
    addButtonsRef.current?.measureLayout(
      scrollNode,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }),
      () => {}
    );
  }

  function handleAddExercise() {
    tapFeedback();
    update({ exerciseRows: [...exerciseRows, newExerciseRow()] });
    // The new row needs a layout pass before its position can be measured —
    // same short-delay pattern already used elsewhere in this file (see the
    // set-complete auto-focus below) rather than an arbitrary guess.
    setTimeout(scrollToAddButtons, 50);
  }

  function handleAddRun() {
    tapFeedback();
    update({ runRows: [...runRows, newRunRow()] });
    setTimeout(scrollToAddButtons, 50);
  }

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
  // Editing set 1's weight/reps also fills any later set that's still blank —
  // most sets are the same or similar, and this saves retyping each one.
  // Sets the member has already typed something into are left alone.
  function updateFirstSetField(rowKey: string, setKey: string, field: "weight" | "reps" | "repsRight" | "repsLeft", value: string) {
    update({
      exerciseRows: exerciseRows.map((r) => {
        if (r.key !== rowKey) return r;
        const isFirstSet = r.setRows[0]?.key === setKey;
        // Set 1's value *before* this keystroke — any other set still
        // exactly matching it (empty, or auto-filled from an earlier
        // keystroke) is still "following" set 1 and keeps syncing. A set
        // the member has edited directly no longer matches, so it stops
        // following from that point on — that's what makes this a live
        // "keep typing and it fills the rest" default rather than a one-shot
        // copy that only ever captures the first character typed.
        const previousFirstValue = r.setRows[0]?.[field] ?? "";
        return {
          ...r,
          setRows: r.setRows.map((sr, idx) => {
            if (sr.key === setKey) return { ...sr, [field]: value };
            if (isFirstSet && idx > 0 && sr[field] === previousFirstValue) return { ...sr, [field]: value };
            return sr;
          }),
        };
      }),
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
  // `isLastInSupersetGroup` is true for standalone exercises (no group to
  // wait on) and for the last exercise rendered within a superset block —
  // false for every other member of that group. A superset round isn't
  // actually "resting" until every exercise in it has been worked through,
  // so starting the countdown after the first or middle exercise's set
  // would cut into time that's really still work, not rest.
  function toggleSetComplete(rowKey: string, setKey: string, isLastInSupersetGroup: boolean) {
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
      if (isLastInSupersetGroup) {
        // The screen stays mounted underneath (this is a stack push, not a
        // replace), so the focus() above still lands once the member comes
        // back — they land straight on the next set with the rest already
        // counted down. Starting the timer here (not on the rest-timer
        // screen's own mount) means it keeps running and still notifies on
        // completion even if they never open that screen at all, or leave it
        // immediately — see lib/rest-timer.tsx for why that distinction matters.
        restTimer.start(restTimerSeconds);
        router.push({ pathname: "/rest-timer" });
      }
    }
    updateSetRow(rowKey, setKey, { completed: !wasCompleted });
  }

  // Lets a member redo a workout without re-typing every exercise. Carries
  // over exercise identity, superset grouping, and set type — but not the
  // specific weights/reps actually done today, since a template describes
  // "what to do next time," not a record of this session (that's what the
  // logged workout itself already is).
  function handleSaveAsTemplate() {
    const rowsWithContent = exerciseRows.filter((r) => r.name.trim());
    if (rowsWithContent.length === 0) return;
    tapFeedback();
    const templateExercises: PrescribedExercise[] = rowsWithContent.map((r) => {
      const firstFilled = r.setRows.find((sr) => sr.weight.trim() || sr.reps.trim() || sr.repsRight.trim() || sr.repsLeft.trim());
      const targetReps = r.perSide
        ? firstFilled?.repsRight.trim() || firstFilled?.repsLeft.trim()
          ? `R${firstFilled.repsRight.trim()} / L${firstFilled.repsLeft.trim()}`
          : null
        : firstFilled?.reps.trim() || null;
      return {
        id: nextKey(),
        exerciseId: r.exerciseId,
        name: r.name.trim(),
        muscleTags: [],
        targetSets: r.setRows.length || null,
        targetReps,
        targetWeight: firstFilled?.weight.trim() || null,
        setType: r.defaultSetType === "standard" ? null : r.defaultSetType,
        sets: null,
        supersetGroup: r.supersetGroup,
        notes: r.notes.trim() || null,
      };
    });
    setPendingWorkoutTemplateSeed({ name: title.trim(), exercises: templateExercises });
    router.push("/workout-template-builder");
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

  // Validates and opens the "How did that feel?" prompt — the actual save
  // (handleSubmit) fires from there, whether the member fills in an RPE or
  // taps Skip, so every format gets asked the same way.
  function handleLogPress() {
    setError(null);
    if (!title.trim() || !date.trim()) {
      setError("Title and date are required.");
      return;
    }
    // A modal mounting while a text field is still focused (and the
    // keyboard + KeyboardAvoidingView are mid-adjustment) is a known rough
    // edge on Android — dismiss first so the modal opens onto a settled
    // screen.
    Keyboard.dismiss();
    setFeelModalOpen(true);
  }

  async function handleSubmit(finalRpe: number | null, finalFeelingNotes: string) {
    // Unlike handleLogPress (which dismisses before the modal even opens),
    // submitting from inside the modal had no equivalent — if the member
    // was still typing in the modal's Notes field, the keyboard was still
    // up for everything that follows (modal close, navigation). Dismissing
    // it up front here keeps that out of the mix.
    Keyboard.dismiss();
    setError(null);
    if (!title.trim() || !date.trim()) {
      setError("Title and date are required.");
      return;
    }

    // Everything below (including the summary/payload building, not just
    // the network call) is inside this try — an uncaught exception in a
    // release build has no red-box to fall back on, it just kills the app,
    // so anything that can throw here needs to end up as a visible error
    // message instead.
    try {
      const rowsWithContent = exerciseRows.filter((r) => r.name.trim());
      const filledSetsByRow = rowsWithContent.map((r) =>
        r.setRows.filter((sr) => sr.weight?.trim() || sr.reps?.trim() || sr.repsRight?.trim() || sr.repsLeft?.trim())
      );

      const exercises: CreateWorkoutExerciseInput[] = rowsWithContent.map((r, idx) => {
        const filled = filledSetsByRow[idx];
        const first = filled[0];
        return {
          exerciseId: r.exerciseId,
          name: r.name.trim(),
          weight: first?.weight?.trim() || null,
          reps: first?.reps?.trim() ? parseInt(first.reps, 10) : null,
          sets: filled.length || null,
          rir: r.rir.trim() ? parseInt(r.rir, 10) : null,
          setDetails: filled.map((sr) => ({
            weight: sr.weight.trim() || null,
            reps: sr.reps.trim() ? parseInt(sr.reps, 10) : null,
            setType: sr.setType === "standard" ? null : sr.setType,
            repsRight: sr.repsRight?.trim() ? parseInt(sr.repsRight, 10) : null,
            repsLeft: sr.repsLeft?.trim() ? parseInt(sr.repsLeft, 10) : null,
          })),
          setType: first && first.setType !== "standard" ? first.setType : null,
          supersetGroup: r.supersetGroup,
          perSide: r.perSide,
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

      // Prefer the live-tracked time whenever the timer was actually used;
      // otherwise fall back to whatever was typed into the manual duration
      // field (shown either for a past date, or when today's timer was never
      // started because the workout was already fully done before logging it).
      const liveElapsed = elapsedSecsNow();
      const finalDurationMins = liveElapsed > 0 ? String(Math.round(liveElapsed / 60)) : durationMins.trim();
      const durationLabel = liveElapsed > 0 ? formatDuration(liveElapsed) : finalDurationMins ? `${finalDurationMins} min` : "—";

      const chipperSummary =
        draft.format === "chipper" && draft.chipperConfig.movements.length > 0
          ? `Chipper: ${draft.chipperConfig.movements
              .filter((m) => m.name.trim())
              .map((m) => {
                const target = m.mode === "reps" ? parseInt(m.targetReps, 10) || 0 : parseDuration(m.targetSeconds) ?? 0;
                const done = m.mode === "reps" ? m.doneReps : m.doneSeconds;
                const doneLabel = m.mode === "reps" ? String(done) : formatDuration(done);
                const targetLabel = m.mode === "reps" ? String(target) : formatDuration(target);
                return `${m.name.trim()} ${doneLabel}/${targetLabel}`;
              })
              .join(", ")}`
          : "";

      const formatSummary =
        draft.format === "chipper"
          ? chipperSummary
          : draft.format !== "standard" && draft.formatResultNote
            ? `${FORMAT_LABELS[draft.format]}: ${draft.formatResultNote}`
            : draft.format !== "standard"
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
      const result = await create.mutateAsync({
        title: title.trim(),
        date: date.trim(),
        durationMins: finalDurationMins,
        notes: combinedNotes,
        exercises,
        runs,
        sessionRpe: finalRpe,
        feelingNotes: finalFeelingNotes.trim() || undefined,
      });
      const summary: WorkoutSummaryData = {
        id: result.id,
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
      if (programId) await advanceProgram.mutateAsync(programId);
      successFeedback();
      // No explicit setFeelModalOpen(false) here — the whole screen (modal
      // included) is about to be replaced by the navigation below anyway.
      // Closing the modal first and THEN navigating stacks two separate
      // native transitions back to back (modal dismiss, then a full screen
      // replace) instead of letting them happen as one; letting the modal
      // get torn down as part of the same screen-replace, rather than
      // beforehand, avoids that collision. Same class of issue as the
      // discard() deferral below, one step earlier in the sequence.
      hasSubmittedRef.current = true;
      setPendingWorkoutSummary(summary);
      router.replace("/workout-summary");
      // Deliberately deferred: discard() resets exerciseRows/runRows/etc to
      // empty, and this screen is still mounted (mid-transition-out) right
      // after router.replace fires, so an immediate call here forces a
      // re-render off the reset state while still on screen — the same
      // class of low-level Android crash (instant kill, no JS stack trace)
      // documented in workout-summary-handoff.ts for oversized nav-state
      // payloads. Waiting for interactions/animations to finish means the
      // reset lands after log-workout has actually been replaced.
      InteractionManager.runAfterInteractions(() => discard());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not log workout. Please try again.");
      setFeelModalOpen(false);
    }
  }

  const timerStarted = draft.accumulatedSecs > 0 || draft.startedAtMs !== null;
  const timerRunning = draft.startedAtMs !== null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LogWorkoutTour />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Workout</Text>
        <Pressable onPress={handleDiscard} hitSlop={12}>
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
      </View>

      <KeyboardAwareScroll ref={scrollRef} contentContainerStyle={styles.scroll}>
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
                <Text style={styles.timerLabel}>LIVE WORKOUT TIME</Text>
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
          ) : null}

          {!isLive || !timerStarted ? (
            <TextField
              label={isLive ? "Already completed? Enter total time (minutes)" : "Duration (minutes) — optional"}
              value={durationMins}
              onChangeText={(v) => update({ durationMins: v })}
              keyboardType="number-pad"
              placeholder="e.g. 60"
            />
          ) : null}
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
          <Text style={styles.formatDescription}>{FORMAT_DESCRIPTIONS[draft.format]}</Text>

          {draft.format === "chipper" ? (
            <Card style={styles.entryCard}>
              <Text style={styles.formatHint}>
                Add each movement with its total target — you&apos;ll log reps (or time) against each one from the
                workout card as you chip away at them.
              </Text>
              <ChipperEditor
                movements={draft.chipperConfig.movements}
                onChange={(movements) => update({ chipperConfig: { movements } })}
              />
              <Button
                title="Go to workout card"
                variant="secondary"
                onPress={() => {
                  update({
                    formatSession: {
                      ...draft.formatSession,
                      started: false,
                      phaseIndex: 0,
                      phaseStartedAtMs: null,
                      phaseElapsedAtPauseSecs: 0,
                      totalElapsedAtPauseSecs: 0,
                      totalStartedAtMs: null,
                    },
                  });
                  router.push({ pathname: "/format-timer" });
                }}
                disabled={draft.chipperConfig.movements.filter((m) => m.name.trim()).length === 0}
                style={{ marginTop: Spacing.md }}
              />
              {draft.formatResultNote ? <Text style={styles.formatResultText}>{draft.formatResultNote}</Text> : null}
            </Card>
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
                title="Go to workout card"
                variant="secondary"
                onPress={() => {
                  update({ formatSession: { ...draft.formatSession, started: false, phaseIndex: 0, phaseStartedAtMs: null, phaseElapsedAtPauseSecs: 0, totalElapsedAtPauseSecs: 0, totalStartedAtMs: null } });
                  router.push({ pathname: "/format-timer" });
                }}
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
              <View style={[styles.unitToggleRow, { marginTop: Spacing.sm }]}>
                <Text style={styles.fieldLabel}>As many...</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Pressable
                    onPress={() => update({ amrapConfig: { ...draft.amrapConfig, subMode: "reps" } })}
                    style={[styles.unitChip, draft.amrapConfig.subMode === "reps" && styles.unitChipActive]}
                  >
                    <Text style={[styles.unitChipText, draft.amrapConfig.subMode === "reps" && styles.unitChipTextActive]}>Reps as possible</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => update({ amrapConfig: { ...draft.amrapConfig, subMode: "rounds" } })}
                    style={[styles.unitChip, draft.amrapConfig.subMode === "rounds" && styles.unitChipActive]}
                  >
                    <Text style={[styles.unitChipText, draft.amrapConfig.subMode === "rounds" && styles.unitChipTextActive]}>Rounds as possible</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.formatHint}>
                {draft.amrapConfig.subMode === "rounds"
                  ? "Set the rep count that completes one round of each movement — the workout card tracks rounds as you go."
                  : "No per-round target — just log total reps completed for each movement on the workout card once time's up."}
              </Text>
              <AmrapMovementsEditor
                movements={draft.amrapConfig.movements}
                subMode={draft.amrapConfig.subMode}
                onChange={(movements) => update({ amrapConfig: { ...draft.amrapConfig, movements } })}
              />
              <Button
                title="Go to workout card"
                variant="secondary"
                onPress={() => {
                  update({ formatSession: { ...draft.formatSession, started: false, phaseIndex: 0, phaseStartedAtMs: null, phaseElapsedAtPauseSecs: 0, totalElapsedAtPauseSecs: 0, totalStartedAtMs: null } });
                  router.push({ pathname: "/format-timer" });
                }}
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
              <EmomMovementsEditor
                movements={draft.emomConfig.movements}
                onChange={(movements) => update({ emomConfig: { ...draft.emomConfig, movements } })}
              />
              <Button
                title="Go to workout card"
                variant="secondary"
                onPress={() => {
                  update({ formatSession: { ...draft.formatSession, started: false, phaseIndex: 0, phaseStartedAtMs: null, phaseElapsedAtPauseSecs: 0, totalElapsedAtPauseSecs: 0, totalStartedAtMs: null } });
                  router.push({ pathname: "/format-timer" });
                }}
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
                title="Go to workout card"
                variant="secondary"
                onPress={() => {
                  update({ formatSession: { ...draft.formatSession, started: false, phaseIndex: 0, phaseStartedAtMs: null, phaseElapsedAtPauseSecs: 0, totalElapsedAtPauseSecs: 0, totalStartedAtMs: null } });
                  router.push({ pathname: "/format-timer" });
                }}
                disabled={draft.tabataConfig.movements.length === 0}
                style={{ marginTop: Spacing.md }}
              />
              {draft.formatResultNote ? <Text style={styles.formatResultText}>{draft.formatResultNote}</Text> : null}
            </Card>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SESSION ENTRIES</Text>
          </View>

          {exerciseRows.length === 0 && runRows.length === 0 ? (
            <Text style={styles.emptyHint}>No entries yet. Use the buttons above to log exercises or a run.</Text>
          ) : null}

          {groupExerciseRowsBySuperset(exerciseRows).map((grp, gIdx) => {
            const isGrouped = grp.rows.length > 1;
            const cards = grp.rows.map((row, memberIdx) => {
            const idx = exerciseRows.indexOf(row);
            const allComplete = row.setRows.length > 0 && row.setRows.every((sr) => sr.completed);
            const last = getLastExercisePerformance(data?.sessions ?? [], row.name);
            return (
            <Card
              key={row.key}
              style={[
                isGrouped ? styles.entryCardGrouped : styles.entryCard,
                isGrouped && memberIdx > 0 && styles.entryCardGroupedDivider,
              ]}
            >
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
                    onPress={() => {
                      // Don't clobber a rest that's already counting down —
                      // only reset to this exercise's rest duration when
                      // there's nothing actively running.
                      if (!restTimer.isRunning) restTimer.reset(restTimerSeconds, row.name || null);
                      router.push({ pathname: "/rest-timer" });
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="timer-outline" size={16} color={Color.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => removeRow(row.key)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Exercise name</Text>
              <ExerciseAutocomplete
                exercises={data?.exerciseLibrary ?? []}
                libraryNames={libraryIndex?.items ?? []}
                value={row.name}
                onChange={(name, exerciseId) => updateRow(row.key, { name, exerciseId })}
              />

              {(() => {
                if (!row.name.trim()) return null;
                const slug = libraryIndex ? findExerciseLibrarySlug(row.name, libraryIndex) : null;
                if (!slug && !last) return null;
                return (
                  <View style={styles.exerciseInfoRow}>
                    {slug ? <ExerciseThumbnail slug={slug} /> : null}
                    <View style={styles.exerciseInfoText}>
                      {slug ? (
                        <Pressable
                          onPress={() => router.push({ pathname: "/exercise-library-detail", params: { slug } })}
                          style={styles.demoLink}
                        >
                          <Ionicons name="play-circle-outline" size={13} color={Color.gold} />
                          <Text style={styles.demoLinkText}>View demonstration</Text>
                        </Pressable>
                      ) : null}
                      {last ? (
                        <Text style={styles.lastTimeText}>
                          Last time ({last.date}): <Text style={styles.lastTimeValue}>{last.summary}</Text>
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })()}

              <View style={styles.unitToggleRow}>
                <Text style={styles.fieldLabel}>{unitModeLabel(row.unitMode)}</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Pressable onPress={() => updateRow(row.key, { unitMode: "weight" })} style={[styles.unitChip, row.unitMode === "weight" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "weight" && styles.unitChipTextActive]}>kg</Text>
                  </Pressable>
                  <Pressable onPress={() => updateRow(row.key, { unitMode: "time" })} style={[styles.unitChip, row.unitMode === "time" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "time" && styles.unitChipTextActive]}>time</Text>
                  </Pressable>
                  <Pressable onPress={() => updateRow(row.key, { unitMode: "band" })} style={[styles.unitChip, row.unitMode === "band" && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, row.unitMode === "band" && styles.unitChipTextActive]}>band</Text>
                  </Pressable>
                </View>
              </View>

              {row.unitMode === "time" ? (
                <Pressable
                  onPress={() => {
                    if (!restTimer.isRunning) restTimer.reset(60, row.name || null);
                    router.push({ pathname: "/rest-timer" });
                  }}
                  style={styles.holdTimerHint}
                >
                  <Ionicons name="hourglass-outline" size={13} color={Color.gold} />
                  <Text style={styles.holdTimerHintText}>Use the countdown timer for holds like planks or wall sits</Text>
                </Pressable>
              ) : null}

              <View style={styles.setColumnHeader}>
                <Text style={[styles.setColumnLabel, { width: 40 }]}>Set</Text>
                <Text style={[styles.setColumnLabel, { flex: 1 }]}>{unitModeColumnLabel(row.unitMode)}</Text>
                <Text style={[styles.setColumnLabel, { flex: 1 }]}>{row.perSide ? "Reps (R/L)" : "Reps"}</Text>
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
                      onChangeText={(v) => updateFirstSetField(row.key, set.key, "weight", v)}
                      onBlur={() => {
                        if (row.unitMode === "band") return;
                        const formatted = row.unitMode === "time" ? formatAsMmSs(set.weight) : formatAsKg(set.weight);
                        if (formatted !== set.weight) updateSetRow(row.key, set.key, { weight: formatted });
                      }}
                      placeholder={lastSet?.weight ?? (row.unitMode === "time" ? "1:30" : row.unitMode === "band" ? "e.g. Purple" : "60")}
                      placeholderTextColor={Color.textFaint}
                      style={[styles.setInput, set.completed && styles.setInputCompleted, { flex: 1 }]}
                    />
                    {row.perSide ? (
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
                    <Pressable
                      onPress={() => toggleSetComplete(row.key, set.key, !isGrouped || memberIdx === grp.rows.length - 1)}
                      hitSlop={8}
                      style={styles.setCheckWrap}
                    >
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

              <Collapsible
                style={styles.moreOptions}
                title="More options"
                summary={
                  [
                    row.supersetGroup ? `Superset ${row.supersetGroup}` : null,
                    row.rir.trim() ? `RIR ${row.rir.trim()}` : null,
                    row.perSide ? "Unilateral" : null,
                    row.notes.trim() ? "Note added" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                defaultExpanded={Boolean(
                  row.supersetGroup || row.rir.trim() || row.perSide || row.notes.trim() || row.defaultSetType !== "standard"
                )}
              >
                <Text style={styles.fieldLabel}>Superset (opt.)</Text>
                <SupersetChips
                  value={row.supersetGroup}
                  allGroups={exerciseRows.map((r) => r.supersetGroup)}
                  onChange={(v) => updateRow(row.key, { supersetGroup: v })}
                />

                <NumberField label="RIR (opt.)" value={row.rir} onChangeText={(v) => updateRow(row.key, { rir: v })} placeholder="e.g. 2" />

                <Pressable
                  onPress={() => updateRow(row.key, { perSide: !row.perSide })}
                  style={styles.supersetRow}
                >
                  <Ionicons
                    name={row.perSide ? "checkbox" : "square-outline"}
                    size={16}
                    color={row.perSide ? Color.gold : Color.textFaint}
                  />
                  <Text style={[styles.supersetText, row.perSide && styles.supersetTextActive]}>
                    Reps are per arm/leg (unilateral)
                  </Text>
                </Pressable>

                <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Notes (optional)</Text>
                <TextInput
                  value={row.notes}
                  onChangeText={(v) => updateRow(row.key, { notes: v })}
                  placeholder="e.g. Felt strong, could go heavier"
                  placeholderTextColor={Color.textFaint}
                  style={styles.smallInput}
                />
              </Collapsible>
            </Card>
            );
            });
            return isGrouped ? (
              <View key={`superset-${grp.group}-${gIdx}`} style={styles.supersetGroupWrap}>
                <View style={styles.supersetGroupHeader}>
                  <Text style={styles.supersetGroupHeaderText}>{grp.group}</Text>
                </View>
                {cards}
              </View>
            ) : (
              cards
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

          <View ref={addButtonsRef} style={styles.addButtonsRow}>
            <Pressable onPress={handleAddExercise} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Exercise</Text>
            </Pressable>
            <Pressable onPress={handleAddRun} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Run</Text>
            </Pressable>
          </View>

          <TextField
            label="Notes — optional"
            value={notes}
            onChangeText={(v) => update({ notes: v })}
            placeholder="What did you do, how did it feel"
            multiline
            style={[styles.multiline, { marginTop: Spacing.lg }]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Log workout" onPress={handleLogPress} loading={create.isPending} style={{ marginTop: Spacing.lg }} />

          {exerciseRows.some((r) => r.name.trim()) ? (
            <Pressable onPress={handleSaveAsTemplate} style={styles.saveTemplateRow}>
              <Ionicons name="bookmark-outline" size={14} color={Color.gold} />
              <Text style={styles.saveTemplateText}>Save as template</Text>
            </Pressable>
          ) : null}
      </KeyboardAwareScroll>

      <HowDidYouFeelModal
        visible={feelModalOpen}
        rpe={sessionRpe}
        onChangeRpe={setSessionRpe}
        notes={feelingNotes}
        onChangeNotes={setFeelingNotes}
        onSkip={() => void handleSubmit(null, "")}
        onSubmit={() => void handleSubmit(sessionRpe, feelingNotes)}
        submitting={create.isPending}
      />
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
  discardText: { fontSize: 12, fontWeight: "500", color: Color.textMuted },
  saveTemplateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Spacing.md, paddingVertical: 6 },
  saveTemplateText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  addChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  addButtonsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.md },
  emptyHint: { fontSize: 12, color: Color.textMuted, borderWidth: 1, borderColor: Color.borderSubtle, borderStyle: "dashed", borderRadius: Radius.md, padding: Spacing.md },
  entryCard: { padding: Spacing.md, marginBottom: Spacing.md },
  // A superset group wraps its member cards in one bordered block with a
  // shared "ST1" label — members render edge-to-edge inside it (no
  // individual margin/radius/border of their own) so it reads as one
  // station, not a stack of separate cards.
  supersetGroupWrap: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  supersetGroupHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Color.goldBorder,
  },
  supersetGroupHeaderText: { fontSize: 12, fontWeight: "700", color: Color.gold, letterSpacing: 0.4 },
  entryCardGrouped: {
    padding: Spacing.md,
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  entryCardGroupedDivider: { borderTopWidth: 1, borderTopColor: Color.goldBorder },
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
  demoLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  demoLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  exerciseInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  exerciseThumb: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Color.surface2 },
  exerciseInfoText: { flex: 1, gap: 4 },
  timerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
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
  moreOptions: { marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  supersetRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  supersetText: { fontSize: 12, color: Color.textMuted },
  supersetTextActive: { color: Color.gold, fontWeight: "600" },
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
  formatDescription: { fontSize: 12, color: Color.textFaint, marginTop: Spacing.sm, lineHeight: 17, fontStyle: "italic" },
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
  // Same as stationValueInput but wider — for fields whose placeholder/value
  // is longer than a couple of digits (EMOM's "reps/time" text, Chipper's
  // rep/duration targets, AMRAP's "reps per round"), which clipped badly at
  // the narrower 56px width sized for plain numeric fields.
  stationValueInputWide: {
    width: 88,
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

const feelStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
  },
  title: { fontSize: 17, fontWeight: "700", color: Color.textPrimary },
  rpeDescription: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.xs, lineHeight: 17 },
  rpeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.md },
  rpeChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
  },
  rpeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  rpeChipText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary },
  rpeChipTextActive: { color: Color.gold },
  notesInput: { marginTop: Spacing.xs, minHeight: 64 },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
});
