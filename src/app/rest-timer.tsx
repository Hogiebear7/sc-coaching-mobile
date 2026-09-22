import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isBatteryOptimizationRelevant, openBatteryOptimizationSettings } from "@/lib/battery-optimization";
import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { useRestTimer } from "@/lib/rest-timer";
import { useTickingValue } from "@/lib/use-ticker";
import { useWorkoutDraft } from "@/lib/workout-draft";
import { TimeWheelPicker } from "@/components/ui/TimeWheelPicker";
import { TimerDial } from "@/components/ui/TimerDial";

const BATTERY_PROMPT_DISMISSED_KEY = "rest-timer-battery-prompt-dismissed-v1";

const PRESETS = [30, 60, 90, 120, 180, 300];

function formatClock(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RestTimerScreen() {
  const router = useRouter();
  const { seconds: initialSecondsParam, autostart, label: labelParam, getReady: getReadyParam } = useLocalSearchParams<{
    seconds?: string;
    autostart?: string;
    /** Exercise name this timer is for — e.g. "Plank" — used only to seed
     *  a fresh countdown's label on arrival. Once a timer's running, the
     *  label lives in context (lib/rest-timer.tsx), not the route, so it
     *  survives navigating away and back. */
    label?: string;
    /** "1" for the "Start timer" button on a genuinely timed exercise —
     *  requests the 3-second get-ready window. Absent for a plain rest. */
    getReady?: string;
  }>();
  const timer = useRestTimer();
  const { update: updateDraft } = useWorkoutDraft();
  const firedDoneFeedback = useRef(false);
  const [showBatteryPrompt, setShowBatteryPrompt] = useState(false);

  useEffect(() => {
    if (!isBatteryOptimizationRelevant()) return;
    AsyncStorage.getItem(BATTERY_PROMPT_DISMISSED_KEY).then((dismissed) => {
      if (!dismissed) setShowBatteryPrompt(true);
    });
  }, []);

  function dismissBatteryPrompt() {
    setShowBatteryPrompt(false);
    AsyncStorage.setItem(BATTERY_PROMPT_DISMISSED_KEY, "1").catch(() => {});
  }

  function handleOpenBatterySettings() {
    tapFeedback();
    void openBatteryOptimizationSettings();
    dismissBatteryPrompt();
  }

  // The auto-start entry point (marking a set complete) already calls
  // timer.start() itself before navigating here — this only covers a
  // fallback if this screen is somehow the one starting it (deep link,
  // future entry point) rather than duplicating the start on every mount.
  useEffect(() => {
    if (autostart === "1" && !timer.isRunning) {
      const secs = Number(initialSecondsParam) > 0 ? Number(initialSecondsParam) : 90;
      timer.start(secs, labelParam ?? null, null, getReadyParam === "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timer.isRunning) firedDoneFeedback.current = false;
  }, [timer.isRunning]);

  const remaining = useTickingValue(() => timer.remainingNow(), timer.isRunning, 250);
  const stopwatchElapsed = useTickingValue(() => timer.stopwatchElapsedNow(), timer.isStopwatchRunning, 1000);
  const preCountdownRemaining = useTickingValue(() => timer.preCountdownRemaining(), timer.isPreCountingDown, 250);

  useEffect(() => {
    if (timer.state.mode !== "countdown") return;
    if (remaining <= 0 && !firedDoneFeedback.current) {
      firedDoneFeedback.current = true;
      successFeedback();
    }
  }, [remaining, timer.state.mode]);

  function handleStartPause() {
    tapFeedback();
    if (timer.isRunning) {
      timer.pause();
      return;
    }
    // Fresh (never engaged — remainingAtPauseSecs still equals durationSecs)
    // or naturally finished: both are a genuine "start," not a continuation,
    // so both need to go through start() to get the 3-second get-ready
    // window. Only a deliberate mid-countdown pause is a resume() — the
    // member's already mid-exercise, nothing to get ready for again.
    const isFreshOrFinished =
      timer.state.remainingAtPauseSecs <= 0 || timer.state.remainingAtPauseSecs === timer.state.durationSecs;
    if (isFreshOrFinished) {
      timer.start(timer.state.durationSecs, timer.state.label);
    } else {
      timer.resume();
    }
  }

  function handleReset() {
    tapFeedback();
    timer.reset(timer.state.durationSecs, timer.state.label);
  }

  function handlePreset(secs: number) {
    tapFeedback();
    timer.reset(secs, timer.state.label);
    // A deliberate preset pick here is "make this my rest duration for the
    // rest of this workout" — not just for the timer sitting on screen
    // right now. See restTimerOverrideSecs in workout-draft.tsx.
    updateDraft({ restTimerOverrideSecs: secs });
  }

  // Wheel-picker edits behave like a preset pick — same "make this my rest
  // duration going forward" semantics — just via a freeform value instead
  // of one of the fixed chips.
  function handleWheelChange(secs: number) {
    timer.reset(secs, timer.state.label);
    updateDraft({ restTimerOverrideSecs: secs });
  }

  function adjust(delta: number) {
    tapFeedback();
    timer.adjust(delta);
  }

  function handleStopwatchStartPause() {
    tapFeedback();
    if (timer.isStopwatchRunning) timer.pauseStopwatch();
    else timer.startStopwatch(timer.state.label);
  }

  function handleStopwatchReset() {
    tapFeedback();
    timer.resetStopwatch(timer.state.label);
  }

  function switchMode(mode: "countdown" | "stopwatch") {
    if (mode === timer.state.mode) return;
    tapFeedback();
    timer.setMode(mode);
  }

  const isStopwatch = timer.state.mode === "stopwatch";
  const pct = timer.state.durationSecs > 0 ? Math.max(0, Math.min(1, remaining / timer.state.durationSecs)) : 0;
  const done = !isStopwatch && remaining === 0;
  // Once a countdown has genuinely been engaged (running, paused partway,
  // or finished), the screen locks into the running-timer view — the
  // duration picker only makes sense before that, same as the device's own
  // Timer app switches from "set it up" to "watch it count down" the
  // moment you hit play.
  const hasStarted = timer.isRunning || done || (timer.state.remainingAtPauseSecs > 0 && timer.state.remainingAtPauseSecs < timer.state.durationSecs);
  const dialAngle = isStopwatch ? 360 * ((stopwatchElapsed % 60) / 60) : 360 * (1 - pct);

  const headerTitle = timer.state.label
    ? `${isStopwatch ? "Stopwatch" : "Countdown"} Timer — ${timer.state.label}`
    : isStopwatch
    ? "Stopwatch"
    : "Rest Timer";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.modeBar}>
        <Pressable onPress={() => switchMode("countdown")} style={[styles.modeButton, !isStopwatch && styles.modeButtonActive]}>
          <Text style={[styles.modeButtonText, !isStopwatch && styles.modeButtonTextActive]}>Countdown</Text>
        </Pressable>
        <Pressable onPress={() => switchMode("stopwatch")} style={[styles.modeButton, isStopwatch && styles.modeButtonActive]}>
          <Text style={[styles.modeButtonText, isStopwatch && styles.modeButtonTextActive]}>Stopwatch</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {showBatteryPrompt && !isStopwatch ? (
          <View style={styles.batteryBanner}>
            <Ionicons name="battery-charging-outline" size={18} color={Color.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.batteryBannerTitle}>Make timer alerts reliable</Text>
              <Text style={styles.batteryBannerBody}>
                Your device can delay or drop this alert in the background unless battery restrictions are off for
                this app.
              </Text>
              <View style={styles.batteryBannerActions}>
                <Pressable onPress={handleOpenBatterySettings}>
                  <Text style={styles.batteryBannerLink}>Open settings</Text>
                </Pressable>
                <Pressable onPress={dismissBatteryPrompt}>
                  <Text style={styles.batteryBannerDismiss}>Not now</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {timer.isPreCountingDown ? (
          <View style={styles.getReadyWrap}>
            <Text style={styles.getReadyLabel}>GET READY</Text>
            <Text style={styles.getReadyNumber}>{preCountdownRemaining}</Text>
            <Text style={styles.getReadyHint}>
              {timer.state.label ? `${timer.state.label} starts in a moment` : "Your rest starts in a moment"}
            </Text>
          </View>
        ) : isStopwatch ? (
          <>
            <View style={styles.dialWrap}>
              <TimerDial progressAngleDeg={dialAngle} showNumbers />
              <View style={styles.dialCenter}>
                <Text style={styles.clockText}>{formatClock(stopwatchElapsed)}</Text>
              </View>
            </View>

            <View style={styles.controlsRow}>
              <Pressable onPress={handleStopwatchReset} style={styles.secondaryControl}>
                <Ionicons name="refresh" size={20} color={Color.textSecondary} />
              </Pressable>
              <Pressable onPress={handleStopwatchStartPause} style={styles.primaryControl}>
                <Ionicons name={timer.isStopwatchRunning ? "pause" : "play"} size={28} color={Color.goldForeground} />
              </Pressable>
              <View style={{ width: 48 }} />
            </View>
          </>
        ) : !hasStarted ? (
          <>
            <View style={styles.pickerWrap}>
              <TimeWheelPicker totalSecs={timer.state.durationSecs} onChange={handleWheelChange} showHours />
            </View>

            <View style={styles.controlsRow}>
              <View style={{ width: 48 }} />
              <Pressable onPress={handleStartPause} style={styles.primaryControl}>
                <Ionicons name="play" size={28} color={Color.goldForeground} />
              </Pressable>
              <View style={{ width: 48 }} />
            </View>

            <View style={styles.presetsWrap}>
              <Text style={styles.presetsLabel}>PRESETS</Text>
              <View style={styles.presetsRow}>
                {PRESETS.map((p) => (
                  <Pressable key={p} onPress={() => handlePreset(p)} style={[styles.presetChip, timer.state.durationSecs === p && styles.presetChipActive]}>
                    <Text style={[styles.presetChipText, timer.state.durationSecs === p && styles.presetChipTextActive]}>
                      {p < 60 ? `${p}s` : `${p / 60}m`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.dialWrap}>
              <TimerDial progressAngleDeg={dialAngle} color={done ? Color.success : Color.gold} />
              <View style={styles.dialCenter}>
                <Text style={[styles.clockText, done && { color: Color.success }]}>{formatClock(remaining)}</Text>
                {done ? (
                  <Text style={styles.doneText}>{timer.state.label ? "Time's up" : "Rest complete"}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.adjustRow}>
              <Pressable onPress={() => adjust(-15)} style={styles.adjustButton}>
                <Text style={styles.adjustText}>−15s</Text>
              </Pressable>
              <Pressable onPress={() => adjust(15)} style={styles.adjustButton}>
                <Text style={styles.adjustText}>+15s</Text>
              </Pressable>
            </View>

            <View style={styles.controlsRow}>
              <Pressable onPress={handleReset} style={styles.secondaryControl}>
                <Ionicons name="refresh" size={20} color={Color.textSecondary} />
              </Pressable>
              <Pressable onPress={handleStartPause} style={styles.primaryControl}>
                <Ionicons name={timer.isRunning ? "pause" : "play"} size={28} color={Color.goldForeground} />
              </Pressable>
              <View style={{ width: 48 }} />
            </View>
          </>
        )}
      </View>
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: Color.textPrimary, marginHorizontal: Spacing.sm },
  modeBar: {
    flexDirection: "row",
    gap: 4,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  modeButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: "center" },
  modeButtonActive: { backgroundColor: Color.surface2 },
  modeButtonText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  modeButtonTextActive: { color: Color.textPrimary },
  body: { flex: 1, alignItems: "center", paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  batteryBanner: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  batteryBannerTitle: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  batteryBannerBody: { fontSize: 12, color: Color.textMuted, marginTop: 2, lineHeight: 16 },
  batteryBannerActions: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.sm },
  batteryBannerLink: { fontSize: 12, fontWeight: "700", color: Color.gold },
  batteryBannerDismiss: { fontSize: 12, fontWeight: "600", color: Color.textFaint },
  dialWrap: { width: 240, height: 240, alignItems: "center", justifyContent: "center" },
  dialCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  pickerWrap: { width: "100%", alignItems: "center", paddingVertical: Spacing.lg },
  clockText: { fontSize: 40, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  doneText: { fontSize: 12, color: Color.success, marginTop: 4, fontWeight: "600" },
  getReadyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  getReadyLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 1.2, color: Color.textMuted },
  getReadyNumber: { fontSize: 96, fontWeight: "800", color: Color.gold, fontVariant: ["tabular-nums"], marginTop: Spacing.sm },
  getReadyHint: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm, textAlign: "center" },
  adjustRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xl },
  adjustButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle },
  adjustText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xl, marginTop: Spacing.xl },
  secondaryControl: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Color.borderSubtle },
  primaryControl: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: Color.gold },
  presetsWrap: { marginTop: Spacing.xxl, width: "100%" },
  presetsLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm, textAlign: "center" },
  presetsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: Spacing.xs },
  presetChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  presetChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  presetChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  presetChipTextActive: { color: Color.gold },
});
