import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { LiveColor as Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { useExerciseLibraryNameIndex } from "@/lib/queries/exercise-library";
import { successFeedback, tapFeedback, warningFeedback } from "@/lib/haptics";
import {
  useClassWorkout,
  useSaveClassWorkout,
  useSendClassRecap,
  type ClassWorkoutExerciseEntry,
  type ClassWorkoutRunEntry,
} from "@/lib/queries/staff";
import { OptionPicker, type PickerOption } from "@/components/ui/OptionPicker";
import { newPlanSet, PlanExerciseCard, type PlanSet, type UnitMode } from "@/components/class/PlanExerciseCard";
import { TimeWheelPicker } from "@/components/ui/TimeWheelPicker";
import { useProfile } from "@/lib/queries/profile";
import { assignSuperset, cleanLonelySupersets, nextSupersetTap } from "@/lib/superset-select";
import { distinctGroups, supersetMemberLabel } from "@/lib/superset-label";
import { DataColor } from "@/constants/theme";
import { weightUnitFor } from "@/lib/weight-input";
import { CARDIO_LABEL, CARDIO_TYPES, hasLevel, type CardioType } from "@/lib/cardio";
import { formatDuration, parseDuration } from "@/lib/workout-formatters";
import { entrySegments, insertEntry, orderedEntries } from "@/lib/entry-order";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `cw-${Date.now()}-${keySeq}`;
}

type WorkoutFormat = "standard" | "circuit" | "amrap" | "emom" | "tabata" | "chipper";

const FORMAT_OPTIONS: { value: WorkoutFormat; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "chipper", label: "Chipper" },
  { value: "circuit", label: "Circuit" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "tabata", label: "Tabata" },
];

type CircuitStation = { key: string; name: string; mode: "reps" | "time"; reps: string; seconds: string };

// The class-workout builder has no live-timer executor — the coach is
// running the session in person — so format config is folded into the
// existing free-text `notes` field members already see, rather than adding
// a new backend field just for this screen.
function buildFormatSummary(
  format: WorkoutFormat,
  circuitStations: CircuitStation[],
  circuitRest: { station: string; round: string },
  circuitRounds: string,
  movements: string[],
  amrapMins: string,
  emomIntervalSecs: string,
  emomTotalMins: string,
  tabataWork: string,
  tabataRest: string,
  tabataRounds: string
): string {
  if (format === "chipper") return "Format: Chipper (for time)";
  if (format === "circuit") {
    const stationList = circuitStations
      .filter((s) => s.name.trim())
      .map((s) => (s.mode === "reps" && s.reps.trim() ? `${s.name} (${s.reps} reps)` : s.mode === "time" && s.seconds.trim() ? `${s.name} (${s.seconds}s)` : s.name))
      .join(", ");
    return `Format: Circuit — ${circuitRounds || "?"} rounds · Stations: ${stationList || "—"} · Rest ${circuitRest.station || "0"}s/station, ${circuitRest.round || "0"}s/round`;
  }
  if (format === "amrap") {
    return `Format: AMRAP — ${amrapMins || "?"} min · Movements: ${movements.join(", ") || "—"}`;
  }
  if (format === "emom") {
    return `Format: EMOM — ${emomIntervalSecs || "60"}s intervals × ${emomTotalMins || "?"} min · Movements: ${movements.join(", ") || "—"}`;
  }
  if (format === "tabata") {
    return `Format: Tabata — ${tabataWork || "20"}s work / ${tabataRest || "10"}s rest × ${tabataRounds || "8"} rounds · Movements: ${movements.join(", ") || "—"}`;
  }
  return "";
}

function newCircuitStation(): CircuitStation {
  return { key: nextKey(), name: "", mode: "reps", reps: "", seconds: "" };
}

function MovementsEditor({ movements, onChange }: { movements: string[]; onChange: (m: string[]) => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [draftText, setDraftText] = useState("");
  function add() {
    const v = draftText.trim();
    if (!v) return;
    onChange([...movements, v]);
    setDraftText("");
  }
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.rowLabel}>Movements</Text>
      <View style={{ flexDirection: "row", gap: Spacing.xs }}>
        <TextInput
          value={draftText}
          onChangeText={setDraftText}
          placeholder="e.g. 10 Burpees"
          placeholderTextColor={Color.textFaint}
          style={[inputStyleBase(), { flex: 1 }]}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Pressable onPress={add} style={styles.formatAddButton}>
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
  const styles = useStyles();
  const Color = useLegacyColors();
  function updateStation(key: string, patch: Partial<CircuitStation>) {
    onChange(stations.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  return (
    <View>
      <Text style={styles.rowLabel}>Stations</Text>
      {stations.map((s, i) => (
        <View key={s.key} style={styles.stationRow}>
          <TextInput
            value={s.name}
            onChangeText={(v) => updateStation(s.key, { name: v })}
            placeholder={`Station ${i + 1} name`}
            placeholderTextColor={Color.textFaint}
            style={[inputStyleBase(), { flex: 1 }]}
          />
          <Pressable onPress={() => updateStation(s.key, { mode: s.mode === "reps" ? "time" : "reps" })} style={styles.formatModeChip}>
            <Text style={styles.formatModeText}>{s.mode === "reps" ? "Reps" : "Time"}</Text>
          </Pressable>
          <TextInput
            value={s.mode === "reps" ? s.reps : s.seconds}
            onChangeText={(v) => updateStation(s.key, s.mode === "reps" ? { reps: v } : { seconds: v })}
            keyboardType="number-pad"
            placeholder={s.mode === "reps" ? "reps" : "secs"}
            placeholderTextColor={Color.textFaint}
            style={[inputStyleBase(), { width: 56, paddingHorizontal: 4 }]}
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

type TemplateRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  /** "ST1", "ST2" ...: exercises sharing a label are done back to back. */
  supersetGroup: string | null;
  /** Reps differ per side: the right and left boxes are used instead of one reps box. */
  perSide: boolean;
  /** What the weight box holds: kg (or lbs), a time, or a band. Only changes the box; the text is what is saved. */
  unitMode: UnitMode;
  /** One row per set, the same way a member's own card shows them. */
  setRows: PlanSet[];
  /** Place in the whole workout, exercises and cardio together. */
  order: number | null;
};

type CardioRow = {
  key: string;
  cardioType: CardioType | null;
  /** The time as "h:mm:ss" or "m:ss", set with the time wheel. */
  duration: string;
  distance: string;
  distanceUnit: "km" | "m";
  /** Machine level or incline, as typed. */
  level: string;
  notes: string;
  order: number | null;
  supersetGroup: string | null;
};

const CARDIO_PICKER_OPTIONS: readonly PickerOption<CardioType>[] = CARDIO_TYPES.map((t) => ({ value: t, label: CARDIO_LABEL[t] }));

function newCardioRow(): CardioRow {
  return { key: nextKey(), cardioType: null, duration: "", distance: "", distanceUnit: "km", level: "", notes: "", order: null, supersetGroup: null };
}

function cardioRowsFromRuns(runs: ClassWorkoutRunEntry[] | undefined): CardioRow[] {
  return (runs ?? []).map((r) => ({
    key: nextKey(),
    cardioType: r.cardioType ?? null,
    duration: r.durationSecs != null ? formatDuration(r.durationSecs) : "",
    distance: r.distance != null ? String(r.distance) : "",
    distanceUnit: "km" as const,
    level: r.level != null ? String(r.level) : "",
    notes: r.notes ?? "",
    order: r.order ?? null,
    supersetGroup: r.supersetGroup ?? null,
  }));
}

type MemberRow = {
  key: string;
  name: string;
  weight: string;
  reps: string;
  sets: string;
  rpe: string;
};

function newTemplateRow(): TemplateRow {
  return { key: nextKey(), exerciseId: null, name: "", supersetGroup: null, perSide: false, unitMode: "weight", setRows: [newPlanSet(), newPlanSet(), newPlanSet(), newPlanSet()], order: null };
}

function inferUnit(weights: string[]): UnitMode {
  const filled = weights.map((w) => w.trim()).filter(Boolean);
  if (filled.length === 0) return "weight";
  if (filled.every((w) => /^\d+:\d{2}$/.test(w))) return "time";
  if (filled.every((w) => /^\d+(\.\d+)?\s*(kg|lbs?)?$/i.test(w))) return "weight";
  return "band";
}

function rowsFromEntries(entries: ClassWorkoutExerciseEntry[] | null): TemplateRow[] {
  if (!entries || entries.length === 0) return [newTemplateRow()];
  return entries.map((e) => {
    const count = e.setDetails?.length ? e.setDetails.length : e.sets && e.sets > 0 ? Math.min(e.sets, 20) : 1;
    const setRows: PlanSet[] = Array.from({ length: count }, (_, i) => {
      const d = e.setDetails?.[i];
      const set = newPlanSet();
      return {
        ...set,
        weight: d?.weight ?? e.weight ?? "",
        reps: d?.reps != null ? String(d.reps) : e.reps != null ? String(e.reps) : "",
        repsRight: d?.repsRight != null ? String(d.repsRight) : "",
        repsLeft: d?.repsLeft != null ? String(d.repsLeft) : "",
      };
    });
    return {
      key: nextKey(),
      exerciseId: e.exerciseId,
      name: e.name,
      supersetGroup: e.supersetGroup ?? null,
      perSide: e.perSide === true,
      unitMode: inferUnit(setRows.map((r) => r.weight)),
      setRows,
      order: e.order ?? null,
    };
  });
}

function memberRowsFromTemplate(
  template: TemplateRow[],
  existing: ClassWorkoutExerciseEntry[] | null
): MemberRow[] {
  return template
    .filter((t) => t.name.trim())
    .map((t) => {
      const prior = existing?.find((e) => e.name.toLowerCase() === t.name.trim().toLowerCase());
      return {
        key: nextKey(),
        name: t.name.trim(),
        weight: prior?.weight ?? t.setRows[0]?.weight ?? "",
        reps: prior?.reps != null ? String(prior.reps) : t.setRows[0]?.reps ?? "",
        sets: prior?.sets != null ? String(prior.sets) : String(t.setRows.length),
        rpe: prior?.rpe != null ? String(prior.rpe) : "",
      };
    });
}

const inputStyleBase = () => ({
  height: 40,
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Color.borderSubtle,
  backgroundColor: Color.surface1,
  paddingHorizontal: Spacing.sm,
  fontSize: 13,
  color: Color.textPrimary,
});

export default function ClassWorkoutBuilderScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { classId, classTitle, classDate, startTime } = useLocalSearchParams<{
    classId: string;
    classTitle?: string;
    classDate?: string;
    startTime?: string;
  }>();

  const { data, isLoading } = useClassWorkout(classId);
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const saveWorkout = useSaveClassWorkout();

  const [template, setTemplate] = useState<TemplateRow[]>([newTemplateRow()]);
  const [cardio, setCardio] = useState<CardioRow[]>([]);
  // The entry last worked on, so a new one goes just below it.
  const [touchedKey, setTouchedKey] = useState<string | null>(null);
  const sendRecap = useSendClassRecap();
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [format, setFormat] = useState<WorkoutFormat>("standard");
  const [circuitStations, setCircuitStations] = useState<CircuitStation[]>([]);
  const [circuitRestStation, setCircuitRestStation] = useState("15");
  const [circuitRestRound, setCircuitRestRound] = useState("60");
  const [circuitRounds, setCircuitRounds] = useState("3");
  const [amrapMins, setAmrapMins] = useState("12");
  const [amrapMovements, setAmrapMovements] = useState<string[]>([]);
  const [emomIntervalSecs, setEmomIntervalSecs] = useState("60");
  const [emomTotalMins, setEmomTotalMins] = useState("10");
  const [emomMovements, setEmomMovements] = useState<string[]>([]);
  const [tabataWork, setTabataWork] = useState("20");
  const [tabataRest, setTabataRest] = useState("10");
  const [tabataRounds, setTabataRounds] = useState("8");
  const [tabataMovements, setTabataMovements] = useState<string[]>([]);
  const [memberRows, setMemberRows] = useState<Record<string, MemberRow[]>>({});
  const [memberNotes, setMemberNotes] = useState<Record<string, string>>({});
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || !data) return;
    setTemplate(rowsFromEntries(data.existingWorkout?.exercises ?? null));
    setCardio(cardioRowsFromRuns(data.existingWorkout?.runs));
    setWorkoutNotes(data.existingWorkout?.notes ?? "");
    setMemberNotes(Object.fromEntries(data.checkedIn.map((m) => [m.userId, m.existingNotes ?? ""])));
    setHydrated(true);
  }, [data, hydrated]);

  function updateTemplate(key: string, patch: Partial<TemplateRow>) {
    setTouchedKey(key);
    setTemplate((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setMessage(null);
  }

  function updateCardio(key: string, patch: Partial<CardioRow>) {
    setTouchedKey(key);
    setCardio((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setMessage(null);
  }

  // New entries go just below the one being worked on, so cardio can sit in the middle of the class.
  function addExercise() {
    const added = newTemplateRow();
    const next = insertEntry(template, cardio, { kind: "exercise", row: added }, touchedKey);
    setTemplate(next.exerciseRows);
    setCardio(next.runRows);
    setTouchedKey(added.key);
    setMessage(null);
  }

  function addCardio() {
    const added = newCardioRow();
    const next = insertEntry(template, cardio, { kind: "run", row: added }, touchedKey);
    setTemplate(next.exerciseRows);
    setCardio(next.runRows);
    setTouchedKey(added.key);
    setMessage(null);
  }

  function rowsFor(userId: string, existingExercises: ClassWorkoutExerciseEntry[] | null): MemberRow[] {
    return memberRows[userId] ?? memberRowsFromTemplate(template, existingExercises);
  }

  function updateMemberRow(userId: string, existingExercises: ClassWorkoutExerciseEntry[] | null, key: string, patch: Partial<MemberRow>) {
    setMemberRows((prev) => {
      const rows = prev[userId] ?? memberRowsFromTemplate(template, existingExercises);
      return { ...prev, [userId]: rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) };
    });
    setMessage(null);
  }

  async function handleSave(): Promise<boolean> {
    if (!data) return false;
    setError(null);
    setMessage(null);

    try {
      const results = data.checkedIn.map((member) => ({
        userId: member.userId,
        notes: memberNotes[member.userId] ?? "",
        exercises: rowsFor(member.userId, member.existingExercises).map((r) => ({
          name: r.name,
          weight: r.weight,
          reps: r.reps.trim() ? Number(r.reps) : null,
          sets: r.sets.trim() ? Number(r.sets) : null,
          rpe: r.rpe.trim() ? Number(r.rpe) : null,
        })),
      }));

      const formatSummary =
        format !== "standard"
          ? buildFormatSummary(
              format,
              circuitStations,
              { station: circuitRestStation, round: circuitRestRound },
              circuitRounds,
              format === "amrap" ? amrapMovements : format === "emom" ? emomMovements : format === "tabata" ? tabataMovements : [],
              amrapMins,
              emomIntervalSecs,
              emomTotalMins,
              tabataWork,
              tabataRest,
              tabataRounds
            )
          : "";
      const combinedNotes = [formatSummary, workoutNotes.trim()].filter(Boolean).join("\n\n");

      const res = await saveWorkout.mutateAsync({
        classId,
        notes: combinedNotes,
        exercises: cleanLonelySupersets(template, cardio).exerciseRows.map((r) => {
          const first = r.setRows[0];
          const num = (v: string) => (v.trim() ? Number(v) : null);
          return {
            exerciseId: r.exerciseId,
            name: r.name,
            weight: first?.weight.trim() ? first.weight.trim() : "",
            reps: r.perSide ? null : num(first?.reps ?? ""),
            sets: r.setRows.length || null,
            supersetGroup: r.supersetGroup,
            perSide: r.perSide,
            setDetails: r.setRows.map((sr) => ({
              weight: sr.weight.trim() || null,
              reps: r.perSide ? null : num(sr.reps),
              repsRight: r.perSide ? num(sr.repsRight) : null,
              repsLeft: r.perSide ? num(sr.repsLeft) : null,
            })),
            order: r.order,
          };
        }),
        runs: cardio
          .filter((c) => c.cardioType || c.duration.trim() || c.distance.trim() || c.notes.trim())
          .map((c) => ({
            distance: c.distance.trim() ? (c.distanceUnit === "m" ? Math.round((Number(c.distance) / 1000) * 1000) / 1000 : Number(c.distance)) : null,
            durationSecs: parseDuration(c.duration),
            level: c.cardioType && hasLevel(c.cardioType) && c.level.trim() ? Number(c.level) : null,
            supersetGroup: cleanLonelySupersets(template, cardio).runRows.find((x) => x.key === c.key)?.supersetGroup ?? null,
            notes: c.notes.trim() || null,
            cardioType: c.cardioType ?? "run",
            order: c.order,
          })),
        results,
      });
      tapFeedback();
      setMessage(res.message ?? "Class workout saved.");
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the class workout.");
      return false;
    }
  }

  // Finish the class workout: save what is on screen, then tell everyone who came. Asks first because it notifies members.
  function handleFinishAndSend() {
    const checkedIn = data?.checkedIn.length ?? 0;
    Alert.alert(
      "Send the recap?",
      checkedIn > 0
        ? `This saves the workout and sends a thank-you notification to the ${checkedIn} member${checkedIn === 1 ? "" : "s"} checked in. They can then look at their workout, change anything, and say how it felt.`
        : "Nobody is checked in for this class yet, so nobody would receive it. Check people in first.",
      checkedIn > 0
        ? [
            { text: "Not yet", style: "cancel" },
            {
              text: "Save and send",
              onPress: async () => {
                const saved = await handleSave();
                if (!saved) return;
                try {
                  const res = await sendRecap.mutateAsync(classId);
                  successFeedback();
                  setMessage(res.message);
                } catch (e) {
                  setError(e instanceof ApiError ? e.message : "Could not send the recap.");
                }
              },
            },
          ]
        : [{ text: "OK" }]
    );
  }

  const { data: profile } = useProfile();
  const weightUnit = weightUnitFor(profile?.preferredUnits);
  const [timeTarget, setTimeTarget] = useState<{ rowKey: string; setKey: string; secs: number } | null>(null);
  const [cardioTimeTarget, setCardioTimeTarget] = useState<{ rowKey: string; secs: number } | null>(null);

  // Start class / Finish and send recap: the recap only makes sense once the class has run.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(`class-started-${classId}`)
      .then((v) => {
        if (alive && v) setStartedAt(Number(v) || null);
      })
      .catch(() => {});
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [classId]);
  const scheduledMs = (() => {
    const d = data?.classDate ?? classDate;
    const t = data?.startTime ?? startTime;
    if (!d || !t) return null;
    const ms = new Date(`${d}T${t}:00`).getTime();
    return Number.isFinite(ms) ? ms : null;
  })();
  // Pressing Start class opens the recap; so does 30 minutes passing since the scheduled start, so a coach who forgets is never stuck.
  const canFinish = !!startedAt || !!data?.existingWorkout?.recapSentAt || (scheduledMs !== null && nowMs >= scheduledMs + 30 * 60_000);
  function startClass() {
    const now = Date.now();
    setStartedAt(now);
    successFeedback();
    AsyncStorage.setItem(`class-started-${classId}`, String(now)).catch(() => {});
  }

  function cycleSuperset(row: { key: string; supersetGroup?: string | null }) {
    const shown = orderedEntries(template, cardio).map((e) => ({ key: e.row.key, supersetGroup: e.row.supersetGroup ?? null }));
    const next = nextSupersetTap(shown, row.key);
    if (next === undefined) {
      warningFeedback();
      return;
    }
    tapFeedback();
    const r = assignSuperset(template, cardio, row.key, next);
    setTemplate(r.exerciseRows);
    setCardio(r.runRows);
    setTouchedKey(row.key);
    setMessage(null);
  }

  // Labels, letters and colours count exercises and cardio together, in the order shown.
  const allGroupLabels = orderedEntries(template, cardio).map((e) => e.row.supersetGroup ?? null);
  const memberNumber = (key: string): number => {
    const entries = orderedEntries(template, cardio);
    const label = entries.find((e) => e.row.key === key)?.row.supersetGroup ?? null;
    if (!label) return 0;
    return Math.max(0, entries.filter((e) => e.row.supersetGroup === label).findIndex((e) => e.row.key === key));
  };
  const cardioColours = [DataColor.sessions, DataColor.load, DataColor.sleep, DataColor.hydration];

  const orderedExercises = entrySegments(template, cardio).flatMap((seg) => (seg.kind === "exercise" ? seg.rows : []));
  const libraryExercises = (data?.libraryExercises ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    section: e.section,
  }));

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
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {data?.classTitle ?? classTitle ?? "Class workout"}
            </Text>
            {(data?.classDate ?? classDate) && (data?.startTime ?? startTime) ? (
              <Text style={styles.headerSubtitle}>
                {data?.classDate ?? classDate} · {data?.startTime ?? startTime}
              </Text>
            ) : null}
          </View>
        </View>

        <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Save the workout below and it lands in every booked member&apos;s Workouts tab right
            away. Once someone&apos;s checked in you can also enter their exact numbers here, which
            sync straight into their history.
          </Text>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          {message ? <Text style={styles.successBanner}>{message}</Text> : null}

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Workout</Text>
            <Text style={styles.sectionHint}>
              The shared plan, laid out like a member&apos;s own workout. Tap an exercise&apos;s number to make a superset, and Reps to split it into right and left. Each member&apos;s row starts from this.
            </Text>

            <View style={{ marginTop: Spacing.md }}>
              {entrySegments(template, cardio).map((seg) => seg.kind === "exercise" ? seg.rows.map((row) => (
                <PlanExerciseCard
                  key={row.key}
                  row={row}
                  number={orderedExercises.findIndex((r) => r.key === row.key) + 1}
                  allGroups={allGroupLabels}
                  memberIndex={memberNumber(row.key)}
                  weightUnit={weightUnit}
                  onChange={(patch) => updateTemplate(row.key, patch)}
                  onCycleSuperset={() => cycleSuperset(row)}
                  onRemove={() => setTemplate((prev) => prev.filter((r) => r.key !== row.key))}
                  onPickTime={(setKey, secs) => setTimeTarget({ rowKey: row.key, setKey, secs: secs ?? 90 })}
                  nameField={
                    <ExerciseAutocomplete
                      exercises={libraryExercises}
                      libraryNames={libraryIndex?.items ?? []}
                      value={row.name}
                      onChange={(name, exerciseId) => updateTemplate(row.key, { name, exerciseId })}
                    />
                  }
                />
              )) : (() => { const c = seg.row; return (
                <View key={c.key} style={styles.templateRow}>
                  <View style={styles.entryHeader}>
                    <Pressable
                      onPress={() => cycleSuperset(c)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={c.supersetGroup ? "Cardio in a superset. Tap to change." : "Cardio. Tap to put it in a superset."}
                      style={[
                        styles.cardioBadge,
                        c.supersetGroup
                          ? { backgroundColor: cardioColours[Math.max(0, distinctGroups(allGroupLabels).indexOf(c.supersetGroup)) % cardioColours.length], borderColor: "transparent" }
                          : null,
                      ]}
                    >
                      {c.supersetGroup ? (
                        <Text style={styles.cardioBadgeText}>{supersetMemberLabel(c.supersetGroup, allGroupLabels, memberNumber(c.key))}</Text>
                      ) : (
                        <Ionicons name="pulse" size={16} color={Color.textPrimary} />
                      )}
                      {!c.supersetGroup ? <Ionicons name="link" size={9} color={Color.textMuted} style={{ position: "absolute", bottom: -4, right: -4 }} /> : null}
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <OptionPicker<CardioType>
                        label={c.cardioType ? CARDIO_LABEL[c.cardioType] : "Cardio"}
                        title="Cardio type"
                        placeholder="Choose a type"
                        options={CARDIO_PICKER_OPTIONS}
                        value={c.cardioType}
                        onChange={(cardioType) => updateCardio(c.key, { cardioType })}
                      />
                    </View>
                    <Pressable
                      onPress={() => setCardio((prev) => prev.filter((r) => r.key !== c.key))}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                  <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>Distance (optional)</Text>
                      <View style={{ flexDirection: "row", gap: Spacing.xs }}>
                        <TextInput
                          value={c.distance}
                          onChangeText={(v) => updateCardio(c.key, { distance: v.replace(/[^0-9.]/g, "") })}
                          placeholder={c.distanceUnit === "m" ? "e.g. 400" : "e.g. 5.2"}
                          placeholderTextColor={Color.textFaint}
                          keyboardType="decimal-pad"
                          style={[inputStyleBase(), { flex: 1 }]}
                        />
                        <Pressable
                          onPress={() => updateCardio(c.key, { distanceUnit: c.distanceUnit === "km" ? "m" : "km" })}
                          accessibilityRole="button"
                          accessibilityLabel={`Distance in ${c.distanceUnit}. Tap to change.`}
                          style={styles.unitSwitch}
                        >
                          <Text style={styles.unitSwitchText}>{c.distanceUnit}</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>Time (optional)</Text>
                      <Pressable
                        onPress={() => {
                          tapFeedback();
                          setCardioTimeTarget({ rowKey: c.key, secs: parseDuration(c.duration) ?? 0 });
                        }}
                        accessibilityRole="button"
                        style={[inputStyleBase(), { justifyContent: "center" }]}
                      >
                        <Text style={{ fontSize: 16, color: c.duration.trim() ? Color.textPrimary : Color.textFaint }}>
                          {c.duration.trim() ? formatDuration(parseDuration(c.duration) ?? 0) : "Set time"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  {c.cardioType && hasLevel(c.cardioType) ? (
                    <View style={{ marginTop: Spacing.sm }}>
                      <Text style={styles.rowLabel}>{c.cardioType === "treadmill_walk" ? "Incline % (optional)" : "Level (optional)"}</Text>
                      <TextInput
                        value={c.level}
                        onChangeText={(v) => updateCardio(c.key, { level: v.replace(/[^0-9.]/g, "") })}
                        placeholder={c.cardioType === "treadmill_walk" ? "e.g. 12" : "e.g. 8"}
                        placeholderTextColor={Color.textFaint}
                        keyboardType="decimal-pad"
                        style={inputStyleBase()}
                      />
                    </View>
                  ) : null}
                  <TextInput
                    value={c.notes}
                    onChangeText={(v) => updateCardio(c.key, { notes: v })}
                    placeholder="Notes (optional), e.g. easy pace"
                    placeholderTextColor={Color.textFaint}
                    style={[inputStyleBase(), { marginTop: Spacing.sm }]}
                  />
                </View>
              ); })())}
            </View>

            <View style={styles.addRow}>
              <Pressable onPress={addExercise} style={styles.addChip}>
                <Text style={styles.addChipText}>+ Add exercise</Text>
              </Pressable>
              <Pressable onPress={addCardio} style={styles.addChip}>
                <Text style={styles.addChipText}>+ Add cardio</Text>
              </Pressable>
            </View>

            <TextInput
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              placeholder="Session notes (optional) — warm-up, focus, scaling options"
              placeholderTextColor={Color.textFaint}
              multiline
              style={[inputStyleBase(), styles.notesInput]}
            />

            <Text style={[styles.rowLabel, { marginTop: Spacing.md }]}>Format</Text>
            <OptionPicker<WorkoutFormat> title="Workout format" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />

            {format === "chipper" ? (
              <Text style={styles.sectionHint}>List the movements above as exercises, done once for time.</Text>
            ) : null}

            {format === "circuit" ? (
              <View style={styles.formatConfig}>
                <StationsEditor stations={circuitStations} onChange={setCircuitStations} />
                <View style={styles.gridRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rest / station (s)</Text>
                    <TextInput value={circuitRestStation} onChangeText={setCircuitRestStation} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rest / round (s)</Text>
                    <TextInput value={circuitRestRound} onChangeText={setCircuitRestRound} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rounds</Text>
                    <TextInput value={circuitRounds} onChangeText={setCircuitRounds} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                </View>
              </View>
            ) : null}

            {format === "amrap" ? (
              <View style={styles.formatConfig}>
                <Text style={styles.rowLabel}>Time cap (mins)</Text>
                <TextInput value={amrapMins} onChangeText={setAmrapMins} keyboardType="number-pad" style={inputStyleBase()} />
                <MovementsEditor movements={amrapMovements} onChange={setAmrapMovements} />
              </View>
            ) : null}

            {format === "emom" ? (
              <View style={styles.formatConfig}>
                <View style={styles.gridRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Interval (secs)</Text>
                    <TextInput value={emomIntervalSecs} onChangeText={setEmomIntervalSecs} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Total (mins)</Text>
                    <TextInput value={emomTotalMins} onChangeText={setEmomTotalMins} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                </View>
                <MovementsEditor movements={emomMovements} onChange={setEmomMovements} />
              </View>
            ) : null}

            {format === "tabata" ? (
              <View style={styles.formatConfig}>
                <View style={styles.gridRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Work (secs)</Text>
                    <TextInput value={tabataWork} onChangeText={setTabataWork} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rest (secs)</Text>
                    <TextInput value={tabataRest} onChangeText={setTabataRest} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rounds</Text>
                    <TextInput value={tabataRounds} onChangeText={setTabataRounds} keyboardType="number-pad" style={inputStyleBase()} />
                  </View>
                </View>
                <MovementsEditor movements={tabataMovements} onChange={setTabataMovements} />
              </View>
            ) : null}
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Checked-in members</Text>
            {!data || data.checkedIn.length === 0 ? (
              <Text style={styles.sectionHint}>
                Nobody is checked in yet. Mark attendance on the Classes tab first — results only
                sync for checked-in members.
              </Text>
            ) : (
              <View style={{ marginTop: Spacing.sm }}>
                {data.checkedIn.map((member) => {
                  const open = openMember === member.userId;
                  const rows = rowsFor(member.userId, member.existingExercises);
                  return (
                    <View key={member.userId} style={styles.memberWell}>
                      <Pressable
                        onPress={() => setOpenMember(open ? null : member.userId)}
                        style={styles.memberHeader}
                      >
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberStatus}>
                          {member.existingExercises ? "Synced — edit" : open ? "Close" : "Enter results"}
                        </Text>
                      </Pressable>

                      {open ? (
                        <View style={styles.memberBody}>
                          {rows.map((row) => (
                            <View key={row.key} style={{ marginBottom: Spacing.sm }}>
                              <Text style={styles.rowLabel}>{row.name}</Text>
                              <View style={styles.gridRow4}>
                                <TextInput
                                  value={row.weight}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { weight: v })}
                                  placeholder="Weight"
                                  placeholderTextColor={Color.textFaint}
                                  style={[inputStyleBase(), { flex: 1 }]}
                                />
                                <TextInput
                                  value={row.reps}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { reps: v })}
                                  placeholder="Reps"
                                  placeholderTextColor={Color.textFaint}
                                  keyboardType="number-pad"
                                  style={[inputStyleBase(), { flex: 1 }]}
                                />
                                <TextInput
                                  value={row.sets}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { sets: v })}
                                  placeholder="Sets"
                                  placeholderTextColor={Color.textFaint}
                                  keyboardType="number-pad"
                                  style={[inputStyleBase(), { flex: 1 }]}
                                />
                                <TextInput
                                  value={row.rpe}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { rpe: v })}
                                  placeholder="RPE"
                                  placeholderTextColor={Color.textFaint}
                                  keyboardType="number-pad"
                                  style={[inputStyleBase(), { flex: 1 }]}
                                />
                              </View>
                            </View>
                          ))}
                          <TextInput
                            value={memberNotes[member.userId] ?? ""}
                            onChangeText={(v) => {
                              setMemberNotes((prev) => ({ ...prev, [member.userId]: v }));
                              setMessage(null);
                            }}
                            placeholder="Notes for this member (optional)"
                            placeholderTextColor={Color.textFaint}
                            style={inputStyleBase()}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          <Button
            title={saveWorkout.isPending ? "Saving…" : "Save & sync to members"}
            onPress={handleSave}
            loading={saveWorkout.isPending}
            style={{ marginTop: Spacing.sm }}
          />
          {canFinish ? (
            <>
              <Button
                title={sendRecap.isPending ? "Sending…" : data?.existingWorkout?.recapSentAt ? "Send the recap again to anyone new" : "Finish and send recap"}
                variant="secondary"
                onPress={handleFinishAndSend}
                loading={sendRecap.isPending}
                style={{ marginTop: Spacing.sm }}
              />
              <Text style={styles.recapHint}>
                {data?.existingWorkout?.recapSentAt
                  ? "The recap has been sent. Members who were checked in already have it."
                  : "When the class is over, this saves the workout and thanks everyone who came, so they can check it and say how it felt."}
              </Text>
            </>
          ) : (
            <>
              <Button title="Start class" variant="secondary" onPress={startClass} style={{ marginTop: Spacing.sm }} />
              <Text style={styles.recapHint}>Press this when the class begins. &quot;Finish and send recap&quot; appears once it has started.</Text>
            </>
          )}
        </KeyboardAwareScroll>
      <Modal visible={timeTarget !== null} transparent animationType="fade" onRequestClose={() => setTimeTarget(null)}>
        <Pressable style={styles.timeBackdrop} onPress={() => setTimeTarget(null)}>
          <View style={styles.timeCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.timeTitle}>Set time</Text>
            {timeTarget ? (
              <TimeWheelPicker totalSecs={timeTarget.secs} onChange={(secs) => setTimeTarget((prev) => (prev ? { ...prev, secs } : prev))} />
            ) : null}
            <Button
              title="Done"
              onPress={() => {
                if (timeTarget) {
                  const text = `${Math.floor(timeTarget.secs / 60)}:${String(timeTarget.secs % 60).padStart(2, "0")}`;
                  setTemplate((prev) =>
                    prev.map((r) => {
                      if (r.key !== timeTarget.rowKey) return r;
                      const at = r.setRows.findIndex((sr) => sr.key === timeTarget.setKey);
                      return { ...r, setRows: r.setRows.map((sr, i) => (i >= at && at !== -1 ? { ...sr, weight: text } : sr)) };
                    })
                  );
                }
                setTimeTarget(null);
              }}
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        </Pressable>
      </Modal>
      <Modal visible={cardioTimeTarget !== null} transparent animationType="fade" onRequestClose={() => setCardioTimeTarget(null)}>
        <Pressable style={styles.timeBackdrop} onPress={() => setCardioTimeTarget(null)}>
          <View style={styles.timeCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.timeTitle}>Cardio time</Text>
            {cardioTimeTarget ? (
              <TimeWheelPicker
                totalSecs={cardioTimeTarget.secs}
                showHours
                onChange={(secs) => setCardioTimeTarget((prev) => (prev ? { ...prev, secs } : prev))}
              />
            ) : null}
            <Button
              title="Done"
              onPress={() => {
                if (cardioTimeTarget) {
                  updateCardio(cardioTimeTarget.rowKey, { duration: cardioTimeTarget.secs > 0 ? formatDuration(cardioTimeTarget.secs) : "" });
                }
                setCardioTimeTarget(null);
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    headerSubtitle: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    intro: { fontSize: 14, color: Color.textMuted, lineHeight: 20, marginBottom: Spacing.md },
    errorBanner: {
      fontSize: 14,
      color: Color.danger,
      backgroundColor: Color.dangerWeak,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.md,
    },
    successBanner: {
      fontSize: 14,
      color: Color.gold,
      backgroundColor: Color.goldWeak,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionCard: { padding: Spacing.md, marginBottom: Spacing.md },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
    sectionHint: { fontSize: 14, color: Color.textMuted, marginTop: 4 },
    timeBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: Spacing.lg },
    timeCard: { width: "100%", maxWidth: 420, backgroundColor: Color.surface1, borderRadius: 24, padding: Spacing.lg },
    timeTitle: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, textAlign: "center", marginBottom: Spacing.md },
    unitSwitch: { minWidth: 52, minHeight: 46, paddingHorizontal: 12, borderRadius: Radius.md, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    unitSwitchText: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
    cardioBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: Color.surface2, borderWidth: 1.5, borderColor: Color.borderDefault, alignItems: "center", justifyContent: "center" },
    cardioBadgeText: { fontSize: 14, fontWeight: "700", color: Color.bg0 },
    templateRow: {
      backgroundColor: Color.surface2,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    entryHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
    removeButton: { paddingHorizontal: Spacing.sm, paddingVertical: 8 },
    removeText: { fontSize: 14, color: Color.danger },
    gridRow: { flexDirection: "row", gap: Spacing.sm },
    gridRow4: { flexDirection: "row", gap: Spacing.xs },
    addChip: {
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      alignSelf: "flex-start",
      marginTop: Spacing.xs, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    addChipText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary },
    notesInput: { marginTop: Spacing.md, minHeight: 64, textAlignVertical: "top", paddingVertical: Spacing.sm },
    memberWell: {
      backgroundColor: Color.surface2,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    memberHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    memberName: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
    memberStatus: { fontSize: 13, color: Color.textMuted },
    memberBody: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    rowLabel: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, marginBottom: 6 },
    recapHint: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.sm, marginBottom: Spacing.lg },
    addRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    extrasRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.xs },
    extrasLabel: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm, marginBottom: 6 },
    sideChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 8, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    sideChipActive: { backgroundColor: Color.gold },
    sideChipText: { fontSize: 14, fontWeight: "600", color: Color.textMuted },
    sideChipTextActive: { color: Color.goldForeground },
    formatRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.xs },
    formatChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 8, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    formatChipActive: { borderColor: Color.gold, backgroundColor: Color.gold },
    formatChipText: { fontSize: 14, fontWeight: "600", color: Color.textMuted },
    formatChipTextActive: { color: Color.goldForeground },
    formatConfig: { marginTop: Spacing.sm },
    formatAddButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Color.gold,
    },
    formatModeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Color.surface2 },
    formatModeText: { fontSize: 12, fontWeight: "700", color: Color.textMuted },
    stationRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
    movementsList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
    movementChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: Color.surface2,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6 },
    movementChipText: { fontSize: 13, color: Color.textSecondary, fontWeight: "500" },
  })
);
