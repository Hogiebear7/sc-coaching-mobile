import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { formatDuration } from "@/lib/workout-formatters";
import {
  useWorkoutDraft,
  type AmrapConfig,
  type CircuitConfig,
  type EmomConfig,
  type FormatSessionState,
  type TabataConfig,
} from "@/lib/workout-draft";

type Phase = { label: string; kind: "work" | "rest"; durationSecs: number; meta: string };

function computeElapsed(startedAtMs: number | null, elapsedAtPauseSecs: number): number {
  if (startedAtMs === null) return elapsedAtPauseSecs;
  return elapsedAtPauseSecs + (Date.now() - startedAtMs) / 1000;
}

// One flat list of phases covers Circuit/EMOM/Tabata with a single countdown
// engine below — a "manual" phase (durationSecs 0, reps-based circuit
// stations) waits for a tap instead of auto-advancing. Next-phase preview is
// just phases[index + 1] — during a rest phase that's naturally the next
// work phase, which is exactly what a preview during rest should show.
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
      const repSuffix =
        s.mode === "reps" && s.reps.trim()
          ? ` — ${s.reps.trim()} reps`
          : s.mode === "time" && s.repTarget.trim()
          ? ` — ${s.repTarget.trim()} reps target`
          : "";
      phases.push({
        label: `${s.name}${repSuffix}`,
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
  const movements = config.movements.length > 0 ? config.movements : [{ key: "0", name: "Work", repsOrTime: "" }];
  const phases: Phase[] = [];
  for (let i = 0; i < count; i++) {
    const m = movements[i % movements.length];
    phases.push({
      label: m.repsOrTime.trim() ? `${m.name} — ${m.repsOrTime.trim()}` : m.name,
      kind: "work",
      durationSecs: interval,
      meta: `Minute ${i + 1} of ${count}`,
    });
  }
  return phases;
}

// Shared timestamp-based clock, reading/writing draft.formatSession —
// phaseStartedAtMs + phaseElapsedAtPauseSecs, not a running counter, for
// the same reason every other live timer in this app works this way: a
// setInterval can't survive this screen unmounting or the app backgrounding,
// wall-clock math doesn't care. State lives in the persisted draft, so
// leaving this screen and coming back (or the app being killed and
// reopened) resumes exactly where it was, not reset to zero.
function usePhaseClock(phases: Phase[], timeCapSecs?: number) {
  const { draft, update } = useWorkoutDraft();
  const session = draft.formatSession;
  const [, forceTick] = useState(0);
  const autoAdvancedForPhaseRef = useRef(-1);

  function setSession(patch: Partial<FormatSessionState>) {
    update({ formatSession: { ...draft.formatSession, ...patch } });
  }

  useEffect(() => {
    if (session.phaseStartedAtMs === null && session.totalStartedAtMs === null) return;
    const id = setInterval(() => forceTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [session.phaseStartedAtMs, session.totalStartedAtMs]);

  const phase = phases[session.phaseIndex];
  const running = session.phaseStartedAtMs !== null;
  const manual = !!phase && phase.durationSecs === 0;

  const elapsedInPhase = computeElapsed(session.phaseStartedAtMs, session.phaseElapsedAtPauseSecs);
  const remaining = phase ? Math.max(0, phase.durationSecs - elapsedInPhase) : 0;

  const totalElapsed = computeElapsed(session.totalStartedAtMs, session.totalElapsedAtPauseSecs);

  function goToPhase(nextIndex: number) {
    if (nextIndex >= phases.length) {
      finish();
      return;
    }
    setSession({ phaseIndex: nextIndex, phaseStartedAtMs: Date.now(), phaseElapsedAtPauseSecs: 0 });
  }

  function finish() {
    setSession({ phaseStartedAtMs: null, totalStartedAtMs: null, totalElapsedAtPauseSecs: Math.round(totalElapsed) });
  }

  // Auto-advance a timed phase once it hits zero — guarded so a burst of
  // re-renders around the zero-crossing can't advance twice.
  useEffect(() => {
    if (!running || manual || !phase) return;
    if (remaining <= 0 && autoAdvancedForPhaseRef.current !== session.phaseIndex) {
      autoAdvancedForPhaseRef.current = session.phaseIndex;
      successFeedback();
      goToPhase(session.phaseIndex + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.ceil(remaining), running, manual]);

  function start() {
    const now = Date.now();
    setSession({ started: true, phaseStartedAtMs: now, totalStartedAtMs: now, phaseElapsedAtPauseSecs: 0, totalElapsedAtPauseSecs: 0, phaseIndex: 0 });
  }

  function togglePause() {
    tapFeedback();
    if (running) {
      setSession({
        phaseStartedAtMs: null,
        phaseElapsedAtPauseSecs: elapsedInPhase,
        totalStartedAtMs: null,
        totalElapsedAtPauseSecs: totalElapsed,
      });
    } else {
      const now = Date.now();
      setSession({ phaseStartedAtMs: now, totalStartedAtMs: now });
    }
  }

  function skipNext() {
    tapFeedback();
    goToPhase(session.phaseIndex + 1);
  }

  // A manual (reps-based) phase has no cap check, so time-capped formats
  // still need the total elapsed watched independently of phase transitions.
  useEffect(() => {
    if (!timeCapSecs || !running) return;
    if (totalElapsed >= timeCapSecs) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.ceil(totalElapsed), timeCapSecs, running]);

  return {
    session,
    phase,
    nextPhase: phases[session.phaseIndex + 1],
    running,
    manual,
    remaining,
    totalElapsed,
    start,
    togglePause,
    skipNext,
    finish,
  };
}

function CircularClock({ label, remaining, durationSecs, kind }: { label: string; remaining: number; durationSecs: number; kind: "work" | "rest" }) {
  const pct = durationSecs > 0 ? Math.max(0, Math.min(1, remaining / durationSecs)) : 0;
  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringTrack} />
      <View style={[styles.ringFill, { height: `${pct * 100}%` }, kind === "rest" && styles.ringFillRest]} />
      <View style={styles.ringCenter}>
        <Text style={styles.clock}>{durationSecs > 0 ? formatDuration(Math.ceil(remaining)) : "—"}</Text>
      </View>
    </View>
  );
}

function FiveSecondCountdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(5);
  useEffect(() => {
    if (count <= 0) {
      onDone();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  return (
    <View style={styles.body}>
      <Text style={styles.getReadyText}>Get ready…</Text>
      <Text style={styles.countdownNumber}>{count}</Text>
    </View>
  );
}

function PhaseWorkoutCard({
  title,
  phases,
  onStart,
  needsCountdown,
}: {
  title: string;
  phases: Phase[];
  onStart: () => void;
  needsCountdown?: boolean;
}) {
  const [counting, setCounting] = useState(false);

  if (counting) {
    return <FiveSecondCountdown onDone={onStart} />;
  }

  const workPhases = phases.filter((p) => p.kind === "work");

  return (
    <ScrollView contentContainerStyle={styles.cardBody}>
      <Text style={styles.cardHint}>Review your {title.toLowerCase()} before you start.</Text>
      <View style={styles.cardList}>
        {workPhases.map((p, i) => (
          <View key={i} style={[styles.cardRow, i > 0 && styles.cardRowDivider]}>
            <Text style={styles.cardRowIndex}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRowLabel}>{p.label}</Text>
              {p.meta ? <Text style={styles.cardRowMeta}>{p.meta}</Text> : null}
            </View>
            {p.durationSecs > 0 ? <Text style={styles.cardRowDuration}>{formatDuration(p.durationSecs)}</Text> : null}
          </View>
        ))}
      </View>
      <Button
        title={`Start ${title.toLowerCase()} timer`}
        onPress={() => (needsCountdown ? setCounting(true) : onStart())}
        disabled={phases.length === 0}
        style={{ marginTop: Spacing.lg, alignSelf: "stretch" }}
      />
    </ScrollView>
  );
}

function PhaseLiveView({ phases, timeCapSecs }: { phases: Phase[]; timeCapSecs?: number }) {
  const clock = usePhaseClock(phases, timeCapSecs);
  const { phase, nextPhase, remaining, totalElapsed, running, manual } = clock;

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

      <CircularClock label={phase.label} remaining={manual ? 0 : remaining} durationSecs={phase.durationSecs} kind={phase.kind} />

      <Text style={styles.totalElapsed}>Total {formatDuration(Math.floor(totalElapsed))}</Text>

      {nextPhase ? (
        <View style={styles.nextPreview}>
          <Text style={styles.nextPreviewLabel}>UP NEXT</Text>
          <Text style={styles.nextPreviewText}>{nextPhase.label}</Text>
        </View>
      ) : null}

      <View style={styles.controlsRow}>
        {manual ? (
          <Button title="Done — next station" onPress={clock.skipNext} style={{ flex: 1 }} />
        ) : (
          <>
            <Pressable onPress={clock.togglePause} style={styles.primaryControl}>
              <Ionicons name={running ? "pause" : "play"} size={28} color={Color.goldForeground} />
            </Pressable>
            <Pressable onPress={clock.skipNext} style={styles.secondaryControl}>
              <Ionicons name="play-skip-forward" size={20} color={Color.textSecondary} />
            </Pressable>
          </>
        )}
      </View>

      <Button title="Finish & save" variant="secondary" onPress={clock.finish} style={{ marginTop: Spacing.lg, alignSelf: "stretch" }} />
    </View>
  );
}

function AmrapWorkoutCard({ config, onStart }: { config: AmrapConfig; onStart: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.cardBody}>
      <Text style={styles.cardHint}>
        {config.subMode === "rounds"
          ? "Work through these movements for as many full rounds as possible before time's up."
          : "Work through these movements for as many reps as possible before time's up."}
      </Text>
      <View style={styles.cardList}>
        {config.movements.map((m, i) => (
          <View key={m.key} style={[styles.cardRow, i > 0 && styles.cardRowDivider]}>
            <Text style={styles.cardRowIndex}>{i + 1}</Text>
            <Text style={styles.cardRowLabel}>{m.name}</Text>
            {config.subMode === "rounds" && m.targetReps ? (
              <Text style={styles.cardRowDuration}>{m.targetReps} reps</Text>
            ) : null}
          </View>
        ))}
      </View>
      <Button
        title="Start AMRAP timer"
        onPress={onStart}
        disabled={config.movements.length === 0}
        style={{ marginTop: Spacing.lg, alignSelf: "stretch" }}
      />
    </ScrollView>
  );
}

function AmrapLiveView({ config }: { config: AmrapConfig }) {
  const { draft, update } = useWorkoutDraft();
  const session = draft.formatSession;
  const [, forceTick] = useState(0);
  const capSecs = Math.max(30, (parseInt(config.timeCapMins, 10) || 12) * 60);
  const finishedRef = useRef(false);

  function setSession(patch: Partial<FormatSessionState>) {
    update({ formatSession: { ...draft.formatSession, ...patch } });
  }

  useEffect(() => {
    if (session.totalStartedAtMs === null) return;
    const id = setInterval(() => forceTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [session.totalStartedAtMs]);

  const running = session.totalStartedAtMs !== null;
  const totalElapsed = computeElapsed(session.totalStartedAtMs, session.totalElapsedAtPauseSecs);
  const remaining = Math.max(0, capSecs - totalElapsed);

  function finish(summary: string) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSession({ totalStartedAtMs: null, totalElapsedAtPauseSecs: Math.round(totalElapsed) });
    update({ formatResultNote: summary });
    successFeedback();
  }

  useEffect(() => {
    if (running && remaining <= 0) {
      const totalCompletedReps = config.movements.reduce((sum, m) => sum + m.completedReps, 0);
      const rounds =
        config.subMode === "rounds"
          ? Math.min(
              ...config.movements.map((m) => {
                const target = parseInt(m.targetReps, 10) || 0;
                return target > 0 ? Math.floor(m.completedReps / target) : 0;
              })
            )
          : 0;
      finish(
        config.subMode === "rounds"
          ? `${Number.isFinite(rounds) ? rounds : 0} round${rounds === 1 ? "" : "s"} completed in ${config.timeCapMins} min.`
          : `${totalCompletedReps} total reps completed in ${config.timeCapMins} min.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.ceil(remaining), running]);

  function togglePause() {
    tapFeedback();
    if (running) {
      setSession({ totalStartedAtMs: null, totalElapsedAtPauseSecs: totalElapsed });
    } else {
      setSession({ totalStartedAtMs: Date.now() });
    }
  }

  function adjustReps(key: string, delta: number) {
    tapFeedback();
    update({
      amrapConfig: {
        ...config,
        movements: config.movements.map((m) => (m.key === key ? { ...m, completedReps: Math.max(0, m.completedReps + delta) } : m)),
      },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.phaseKind}>AMRAP</Text>
      <Text style={styles.clock}>{formatDuration(Math.ceil(remaining))}</Text>

      <View style={styles.amrapMovements}>
        {config.movements.map((m) => (
          <View key={m.key} style={styles.amrapMovementRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.amrapMovementText}>{m.name}</Text>
              {config.subMode === "rounds" && m.targetReps ? (
                <Text style={styles.amrapMovementSub}>target {m.targetReps} / round</Text>
              ) : null}
            </View>
            <Pressable onPress={() => adjustReps(m.key, -1)} style={styles.stepperButtonSmall}>
              <Ionicons name="remove" size={16} color={Color.textPrimary} />
            </Pressable>
            <Text style={styles.amrapRepsValue}>{m.completedReps}</Text>
            <Pressable onPress={() => adjustReps(m.key, 1)} style={styles.stepperButtonSmall}>
              <Ionicons name="add" size={16} color={Color.textPrimary} />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.controlsRow}>
        <Pressable onPress={togglePause} style={styles.primaryControl}>
          <Ionicons name={running ? "pause" : "play"} size={28} color={Color.goldForeground} />
        </Pressable>
      </View>

      <Button
        title="Finish & save"
        onPress={() => {
          const totalCompletedReps = config.movements.reduce((sum, m) => sum + m.completedReps, 0);
          finish(`${totalCompletedReps} total reps completed in ${formatDuration(Math.floor(totalElapsed))}.`);
        }}
        style={{ marginTop: Spacing.lg, alignSelf: "stretch" }}
      />
    </ScrollView>
  );
}

export default function FormatTimerScreen() {
  const router = useRouter();
  const { draft, update } = useWorkoutDraft();

  function handleStart() {
    update({ formatSession: { ...draft.formatSession, started: true, phaseStartedAtMs: Date.now(), totalStartedAtMs: Date.now(), phaseIndex: 0, phaseElapsedAtPauseSecs: 0, totalElapsedAtPauseSecs: 0 } });
  }

  let title = "Format Timer";
  let body: React.ReactNode;

  if (draft.format === "amrap") {
    title = "AMRAP";
    body = draft.formatSession.started ? (
      <AmrapLiveView config={draft.amrapConfig} />
    ) : (
      <AmrapWorkoutCard config={draft.amrapConfig} onStart={handleStart} />
    );
  } else if (draft.format === "tabata") {
    title = "Tabata";
    const phases = buildTabataPhases(draft.tabataConfig);
    body = draft.formatSession.started ? (
      <PhaseLiveView phases={phases} />
    ) : (
      <PhaseWorkoutCard title="Tabata" phases={phases} onStart={handleStart} />
    );
  } else if (draft.format === "emom") {
    title = "EMOM";
    const phases = buildEmomPhases(draft.emomConfig);
    body = draft.formatSession.started ? (
      <PhaseLiveView phases={phases} />
    ) : (
      <PhaseWorkoutCard title="EMOM" phases={phases} onStart={handleStart} />
    );
  } else if (draft.format === "circuit") {
    title = "Circuit";
    const phases = buildCircuitPhases(draft.circuitConfig);
    const capSecs =
      draft.circuitConfig.capMode === "time"
        ? Math.max(30, (parseInt(draft.circuitConfig.timeCapMins, 10) || 20) * 60)
        : undefined;
    body = draft.formatSession.started ? (
      <PhaseLiveView phases={phases} timeCapSecs={capSecs} />
    ) : (
      <PhaseWorkoutCard title="Circuit" phases={phases} onStart={handleStart} needsCountdown />
    );
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
  body: { flexGrow: 1, alignItems: "center", paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  doneText: { fontSize: 14, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xl },
  getReadyText: { fontSize: 16, fontWeight: "600", color: Color.textMuted, marginTop: Spacing.xxl },
  countdownNumber: { fontSize: 96, fontWeight: "700", color: Color.gold, marginTop: Spacing.lg, fontVariant: ["tabular-nums"] },
  cardBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  cardHint: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm, lineHeight: 18 },
  cardList: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    overflow: "hidden",
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md },
  cardRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  cardRowIndex: { fontSize: 12, fontWeight: "700", color: Color.gold, width: 18 },
  cardRowLabel: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, flex: 1 },
  cardRowMeta: { fontSize: 11, color: Color.textFaint, marginTop: 2 },
  cardRowDuration: { fontSize: 12, color: Color.textMuted, fontVariant: ["tabular-nums"] },
  phaseKind: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: Color.gold },
  phaseLabel: { fontSize: 26, fontWeight: "700", color: Color.textPrimary, textAlign: "center", marginTop: Spacing.xs },
  phaseMeta: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  clock: { fontSize: 56, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"], marginTop: Spacing.lg },
  ringWrap: {
    width: 240,
    height: 240,
    borderRadius: 120,
    overflow: "hidden",
    justifyContent: "flex-end",
    borderWidth: 2,
    borderColor: Color.borderDefault,
    marginTop: Spacing.lg,
  },
  ringTrack: { ...StyleSheet.absoluteFill, backgroundColor: Color.surface1 },
  ringFill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: Color.goldWeak },
  ringFillRest: { backgroundColor: Color.surface3 },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  totalElapsed: { fontSize: 12, color: Color.textFaint, marginTop: Spacing.md },
  nextPreview: { alignItems: "center", marginTop: Spacing.lg, opacity: 0.8 },
  nextPreviewLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textFaint },
  nextPreviewText: { fontSize: 14, fontWeight: "600", color: Color.textSecondary, marginTop: 2 },
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
    gap: Spacing.sm,
  },
  amrapMovementRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  amrapMovementText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary },
  amrapMovementSub: { fontSize: 10, color: Color.textFaint, marginTop: 1 },
  amrapRepsValue: { fontSize: 16, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"], minWidth: 28, textAlign: "center" },
  stepperButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
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
