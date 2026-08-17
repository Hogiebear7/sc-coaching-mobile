import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { useRestTimer } from "@/lib/rest-timer";

const PRESETS = [30, 60, 90, 120, 180, 300];

function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RestTimerScreen() {
  const router = useRouter();
  const { seconds: initialSecondsParam, autostart } = useLocalSearchParams<{ seconds?: string; autostart?: string }>();
  const timer = useRestTimer();
  // Purely a re-render trigger — the actual value read each render is
  // timer.remainingNow() below, wall-clock-derived so it's always correct
  // on its own, including right after this screen was unmounted for a
  // while (navigated away, backgrounded) and remounts. No separate synced
  // "remaining" state to de-sync from that source of truth.
  const [, forceTick] = useState(0);
  const firedDoneFeedback = useRef(false);

  // The auto-start entry point (marking a set complete) already calls
  // timer.start() itself before navigating here — this only covers a
  // fallback if this screen is somehow the one starting it (deep link,
  // future entry point) rather than duplicating the start on every mount.
  useEffect(() => {
    if (autostart === "1" && !timer.isRunning) {
      const secs = Number(initialSecondsParam) > 0 ? Number(initialSecondsParam) : 90;
      timer.start(secs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!timer.isRunning) return;
    firedDoneFeedback.current = false;
    const id = setInterval(() => forceTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [timer.isRunning]);

  const remaining = timer.remainingNow();

  useEffect(() => {
    if (remaining <= 0 && !firedDoneFeedback.current) {
      firedDoneFeedback.current = true;
      successFeedback();
    }
  }, [remaining]);

  function handleStartPause() {
    tapFeedback();
    if (timer.isRunning) {
      timer.pause();
    } else if (timer.state.remainingAtPauseSecs <= 0) {
      timer.start(timer.state.durationSecs);
    } else {
      timer.resume();
    }
  }

  function handleReset() {
    tapFeedback();
    timer.reset(timer.state.durationSecs);
  }

  function handlePreset(secs: number) {
    tapFeedback();
    timer.reset(secs);
  }

  function adjust(delta: number) {
    tapFeedback();
    timer.adjust(delta);
  }

  const pct = timer.state.durationSecs > 0 ? Math.max(0, Math.min(1, remaining / timer.state.durationSecs)) : 0;
  const done = remaining === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Rest Timer</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.ringWrap}>
          <View style={[styles.ringTrack]} />
          <View style={[styles.ringFill, { height: `${pct * 100}%` }]} />
          <View style={styles.ringCenter}>
            <Text style={[styles.clockText, done && { color: Color.success }]}>{formatClock(remaining)}</Text>
            {done ? <Text style={styles.doneText}>Rest complete</Text> : null}
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
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  body: { flex: 1, alignItems: "center", paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  ringWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: "hidden",
    justifyContent: "flex-end",
    borderWidth: 2,
    borderColor: Color.borderDefault,
  },
  ringTrack: { ...StyleSheet.absoluteFill, backgroundColor: Color.surface1 },
  ringFill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: Color.goldWeak },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  clockText: { fontSize: 48, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  doneText: { fontSize: 12, color: Color.success, marginTop: 4, fontWeight: "600" },
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
