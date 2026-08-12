import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { formatDuration } from "@/lib/workout-formatters";
import {
  useWorkoutDraft,
  type AmrapConfig,
  type CircuitConfig,
  type EmomConfig,
  type TabataConfig,
} from "@/lib/workout-draft";

type Phase = { label: string; kind: "work" | "rest"; durationSecs: number; meta: string };

// One flat list of phases covers Circuit/EMOM/Tabata with a single countdown
// engine below — a "manual" phase (durationSecs 0, reps-based circuit
// stations) waits for a tap instead of auto-advancing.
function buildCircuitPhases(config: CircuitConfig): Phase[] {
  const stations = config.stations.filter((s) => s.name.trim());
  if (stations.length === 0) return [];
  const restStation = Math.max(0, parseInt(config.restBetweenStationsSecs, 10) || 0);
  const restRound = Math.max(0, parseInt(config.restBetweenSetsSecs, 10) || 0);
  // "Time cap" mode has no fixed round count — 50 rounds is far beyond any
  // realistic session and just gives the wall-clock cap room to cut it short.
  const roundsCount = config.capMode === "sets" ? Math.max(1, parseInt(config.totalSets, 10) || 1) : 50;
  const phases: Phase[] = [];
  for (let r = 0; r < roundsCount; r++) {
    stations.forEach((s, i) => {
      const dur = s.mode === "time" ? Math.max(1, parseInt(s.seconds, 10) || 30) : 0;
      phases.push({
        label: s.mode === "reps" && s.reps.trim() ? `${s.name} — ${s.reps.trim()} reps` : s.name,
        kind: "work",
        durationSecs: dur,
        meta: `Round ${r + 1}${config.capMode === "sets" ? ` of ${roundsCount}` : ""} · Station ${i + 1}/${stations.length}`,
      });
      if (restStation > 0 && i < stations.length - 1) {
        phases.push({ label: "Rest", kind: "rest", durationSecs: restStation, meta: `Round ${r + 1}` });
      }
    });
    if (restRound > 0 && r < roundsCount - 1) {
      phases.push({ label: "Rest before next round", kind: "rest", durationSecs: restRound, meta: "" });
    }
  }
  return phases;
}

function buildTabataPhases(config: TabataConfig): Phase[] {
  const rounds = Math.max(1, parseInt(config.rounds, 10) || 8);
  const work = Math.max(1, parseInt(config.workSecs, 10) || 20);
  const rest = Math.max(0, parseInt(config.restSecs, 10) || 10);
  const movements = config.movements.length > 0 ? config.movements : ["Work"];
  const phases: Phase[] = [];
  for (let r = 0; r < rounds; r++) {
    const label = movements[r % movements.length];
    phases.push({ label, kind: "work", durationSecs: work, meta: `Round ${r + 1} of ${rounds}` });
    if (rest > 0) phases.push({ label: "Rest", kind: "rest", durationSecs: rest, meta: `Round ${r + 1} of ${rounds}` });
  }
  return phases;
}

function buildEmomPhases(config: EmomConfig): Phase[] {
  const interval = Math.max(5, parseInt(config.intervalSecs, 10) || 60);
  const totalSecs = Math.max(interval, (parseInt(config.totalMins, 10) || 10) * 60);
  const count = Math.max(1, Math.round(totalSecs / interval));
  const movements = config.movements.length > 0 ? config.movements : ["Work"];
  const phases: Phase[] = [];
  for (let i = 0; i < count; i++) {
    phases.push({ label: movements[i % movements.length], kind: "work", durationSecs: interval, meta: `Minute ${i + 1} of ${count}` });
  }
  return phases;
}

function PhaseEngine({
  phases,
  timeCapSecs,
  onFinish,
}: {
  phases: Phase[];
  timeCapSecs?: number;
  onFinish: (summary: string) => void;
}) {
  const stepIndexRef = useRef(0);
  const totalElapsedRef = useRef(0);
  const finishedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(phases[0]?.durationSecs ?? 0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const phase = phases[stepIndex];
  const manual = !!phase && phase.durationSecs === 0;

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    successFeedback();
    const workPhases = phases.slice(0, stepIndexRef.current + 1).filter((p) => p.kind === "work").length;
    onFinish(`${workPhases} work interval${workPhases === 1 ? "" : "s"} completed in ${formatDuration(totalElapsedRef.current)}.`);
  }

  function goToStep(next: number) {
    if (next >= phases.length) {
      finish();
      return;
    }
    stepIndexRef.current = next;
    setStepIndex(next);
    setRemaining(phases[next].durationSecs);
  }

  function handleNext() {
    tapFeedback();
    goToStep(stepIndexRef.current + 1);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      totalElapsedRef.current += 1;
      setTotalElapsed(totalElapsedRef.current);
      if (timeCapSecs && totalElapsedRef.current >= timeCapSecs) {
        finish();
        return;
      }
      const current = phases[stepIndexRef.current];
      if (!current || current.durationSecs === 0) return;
      setRemaining((prev) => {
        if (prev <= 1) {
          successFeedback();
          goToStep(stepIndexRef.current + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (!phase) {
    return (
      <View style={styles.body}>
        <Text style={styles.doneText}>Nothing to run — add stations or movements on Log Workout first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.phaseKind}>{phase.kind === "rest" ? "REST" : "WORK"}</Text>
      <Text style={styles.phaseLabel}>{phase.label}</Text>
      {phase.meta ? <Text style={styles.phaseMeta}>{phase.meta}</Text> : null}
      <Text style={[styles.clock, phase.kind === "rest" && styles.clockRest]}>
        {manual ? "—" : formatDuration(remaining)}
      </Text>
      <Text style={styles.totalElapsed}>Total {formatDuration(totalElapsed)}</Text>

      <View style={styles.controlsRow}>
        {manual ? (
          <Button title="Done — next station" onPress={handleNext} style={{ flex: 1 }} />
        ) : (
          <>
            <Pressable
              onPress={() => {
                tapFeedback();
                setRunning((r) => !r);
              }}
              style={styles.primaryControl}
            >
              <Ionicons name={running ? "pause" : "play"} size={28} color={Color.goldForeground} />
            </Pressable>
            <Pressable onPress={handleNext} style={styles.secondaryControl}>
              <Ionicons name="play-skip-forward" size={20} color={Color.textSecondary} />
            </Pressable>
          </>
        )}
      </View>

      <Button title="Finish & save" variant="secondary" onPress={finish} style={{ marginTop: Spacing.lg, alignSelf: "stretch" }} />
    </View>
  );
}

function AmrapEngine({
  config,
  onFinish,
}: {
  config: AmrapConfig;
  onFinish: (result: { roundsCompleted: string; extraReps: string }, summary: string) => void;
}) {
  const capSecs = Math.max(30, (parseInt(config.timeCapMins, 10) || 12) * 60);
  const roundsRef = useRef(parseInt(config.roundsCompleted, 10) || 0);
  const extraRepsRef = useRef(config.extraReps ?? "");
  const remainingRef = useRef(capSecs);
  const finishedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [remaining, setRemaining] = useState(capSecs);
  const [running, setRunning] = useState(true);
  const [rounds, setRoundsState] = useState(roundsRef.current);
  const [extraReps, setExtraRepsState] = useState(extraRepsRef.current);

  function setRounds(v: number) {
    roundsRef.current = v;
    setRoundsState(v);
  }
  function setExtraReps(v: string) {
    extraRepsRef.current = v;
    setExtraRepsState(v);
  }

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    successFeedback();
    const r = roundsRef.current;
    const extra = extraRepsRef.current.trim();
    onFinish(
      { roundsCompleted: String(r), extraReps: extra },
      `${r} round${r === 1 ? "" : "s"}${extra ? ` + ${extra} reps` : ""} in ${config.timeCapMins} min.`
    );
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev <= 1 ? 0 : prev - 1;
        remainingRef.current = next;
        if (next === 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          successFeedback();
          finish();
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.phaseKind}>AMRAP</Text>
      <Text style={styles.clock}>{formatDuration(remaining)}</Text>

      {config.movements.length > 0 ? (
        <View style={styles.amrapMovements}>
          {config.movements.map((m, i) => (
            <Text key={i} style={styles.amrapMovementText}>
              • {m}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.roundStepper}>
        <Pressable
          onPress={() => {
            tapFeedback();
            setRounds(Math.max(0, rounds - 1));
          }}
          style={styles.stepperButton}
        >
          <Ionicons name="remove" size={22} color={Color.textPrimary} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.roundsValue}>{rounds}</Text>
          <Text style={styles.roundsLabel}>rounds</Text>
        </View>
        <Pressable
          onPress={() => {
            tapFeedback();
            setRounds(rounds + 1);
          }}
          style={styles.stepperButton}
        >
          <Ionicons name="add" size={22} color={Color.textPrimary} />
        </Pressable>
      </View>

      <TextField
        label="Extra reps (partial round)"
        value={extraReps}
        onChangeText={setExtraReps}
        keyboardType="number-pad"
        placeholder="e.g. 8"
        style={{ width: "100%" }}
      />

      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => {
            tapFeedback();
            setRunning((r) => !r);
          }}
          style={styles.primaryControl}
        >
          <Ionicons name={running ? "pause" : "play"} size={28} color={Color.goldForeground} />
        </Pressable>
      </View>

      <Button title="Finish & save" onPress={finish} style={{ marginTop: Spacing.lg, alignSelf: "stretch" }} />
    </ScrollView>
  );
}

export default function FormatTimerScreen() {
  const router = useRouter();
  const { draft, update } = useWorkoutDraft();

  function handlePhaseFinish(summary: string) {
    update({ formatResultNote: summary });
    router.back();
  }

  function handleAmrapFinish(result: { roundsCompleted: string; extraReps: string }, summary: string) {
    update({
      amrapConfig: { ...draft.amrapConfig, roundsCompleted: result.roundsCompleted, extraReps: result.extraReps },
      formatResultNote: summary,
    });
    router.back();
  }

  let title = "Format Timer";
  let body: React.ReactNode;

  if (draft.format === "amrap") {
    title = "AMRAP";
    body = <AmrapEngine config={draft.amrapConfig} onFinish={handleAmrapFinish} />;
  } else if (draft.format === "tabata") {
    title = "Tabata";
    body = <PhaseEngine phases={buildTabataPhases(draft.tabataConfig)} onFinish={handlePhaseFinish} />;
  } else if (draft.format === "emom") {
    title = "EMOM";
    body = <PhaseEngine phases={buildEmomPhases(draft.emomConfig)} onFinish={handlePhaseFinish} />;
  } else if (draft.format === "circuit") {
    title = "Circuit";
    const capSecs =
      draft.circuitConfig.capMode === "time"
        ? Math.max(30, (parseInt(draft.circuitConfig.timeCapMins, 10) || 20) * 60)
        : undefined;
    body = <PhaseEngine phases={buildCircuitPhases(draft.circuitConfig)} timeCapSecs={capSecs} onFinish={handlePhaseFinish} />;
  } else {
    body = (
      <View style={styles.body}>
        <Text style={styles.doneText}>Pick a workout format on Log Workout first.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>
      {body}
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
  body: { flexGrow: 1, alignItems: "center", paddingTop: Spacing.xxl, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  doneText: { fontSize: 14, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xl },
  phaseKind: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: Color.gold },
  phaseLabel: { fontSize: 24, fontWeight: "700", color: Color.textPrimary, textAlign: "center", marginTop: Spacing.xs },
  phaseMeta: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  clock: { fontSize: 56, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"], marginTop: Spacing.lg },
  clockRest: { color: Color.textSecondary },
  totalElapsed: { fontSize: 12, color: Color.textFaint, marginTop: 4 },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xl, marginTop: Spacing.xl },
  secondaryControl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  primaryControl: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: Color.gold },
  amrapMovements: {
    width: "100%",
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.md,
  },
  amrapMovementText: { fontSize: 13, color: Color.textSecondary, marginBottom: 4 },
  roundStepper: { flexDirection: "row", alignItems: "center", gap: Spacing.xl, marginTop: Spacing.xl },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  roundsValue: { fontSize: 32, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  roundsLabel: { fontSize: 11, color: Color.textMuted },
});
