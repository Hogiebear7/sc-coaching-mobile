import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useRestTimer } from "@/lib/rest-timer";
import { useTickingValue } from "@/lib/use-ticker";

function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact rest-timer readout pinned to the bottom of the active-workout
 * screen. This is now the primary way a between-sets countdown is seen —
 * set-complete no longer navigates to the full-screen /rest-timer route,
 * so a member stays on the exercise list (next set, next weight) while it
 * counts down. That full-screen route (stopwatch mode, presets) is still
 * reachable via `onExpand`, for anyone who wants more than -15/+15/skip.
 */
export function RestTimerBar({ onExpand }: { onExpand: () => void }) {
  const timer = useRestTimer();
  const insets = useSafeAreaInsets();
  const remaining = useTickingValue(() => timer.remainingNow(), timer.isRunning, 250);
  const preCountdownRemaining = useTickingValue(() => timer.preCountdownRemaining(), timer.isPreCountingDown, 250);
  // A countdown counts as "active" here whether it's ticking, paused
  // mid-way through, or still in its pre-start get-ready window — but not
  // in its default/freshly-reset state, where remainingAtPauseSecs always
  // equals durationSecs (see lib/rest-timer.tsx: start/reset always set
  // both together). That's what keeps this bar hidden until a rest is
  // genuinely underway or about to be.
  const active =
    timer.isPreCountingDown ||
    (timer.state.mode === "countdown" &&
      (timer.isRunning || (timer.state.remainingAtPauseSecs > 0 && timer.state.remainingAtPauseSecs < timer.state.durationSecs)));

  if (!active) return null;

  if (timer.isPreCountingDown) {
    return (
      <View style={[styles.bar, styles.barGetReady, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <Text style={styles.getReadyText}>GET READY</Text>
        <Text style={styles.getReadyClock}>{preCountdownRemaining}</Text>
      </View>
    );
  }

  const done = timer.isRunning && remaining <= 0;

  function handleAdjust(delta: number) {
    tapFeedback();
    timer.adjust(delta);
  }

  function handlePauseResume() {
    tapFeedback();
    if (timer.isRunning) timer.pause();
    else timer.resume();
  }

  function handleSkip() {
    tapFeedback();
    timer.reset(timer.state.durationSecs, timer.state.label);
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      <Pressable onPress={() => handleAdjust(-15)} hitSlop={8} style={styles.adjustButton}>
        <Text style={styles.adjustText}>−15s</Text>
      </Pressable>

      <Pressable onPress={onExpand} style={styles.clockWrap} hitSlop={4}>
        <Text style={styles.label} numberOfLines={1}>
          {timer.state.label ?? "Rest"}
        </Text>
        <Text style={[styles.clock, done && styles.clockDone]}>{formatClock(remaining)}</Text>
      </Pressable>

      <Pressable onPress={() => handleAdjust(15)} hitSlop={8} style={styles.adjustButton}>
        <Text style={styles.adjustText}>+15s</Text>
      </Pressable>

      <Pressable onPress={handlePauseResume} hitSlop={8} style={styles.iconButton}>
        <Ionicons name={timer.isRunning ? "pause" : "play"} size={16} color={Color.goldForeground} />
      </Pressable>

      <Pressable onPress={handleSkip} hitSlop={8}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.goldBorder,
    backgroundColor: Color.surface1,
  },
  barGetReady: { justifyContent: "center", gap: Spacing.sm },
  getReadyText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  getReadyClock: { fontSize: 22, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  adjustButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  adjustText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  clockWrap: { flex: 1, alignItems: "center" },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, color: Color.textMuted, textTransform: "uppercase" },
  clock: { fontSize: 22, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  clockDone: { color: Color.success },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.gold,
  },
  skipText: { fontSize: 13, fontWeight: "700", color: Color.textMuted },
});
