import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";

const PRESETS = [30, 60, 90, 120, 180, 300];

function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Schedules a local notification so the rest alert fires even if the member
// backgrounds the app to check something else mid-rest. Harmless no-op if
// notification permission was never granted (see push-notifications.ts —
// same "degrade quietly" philosophy).
async function scheduleRestDoneNotification(seconds: number): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: "Rest complete", body: "Time for your next set." },
      trigger: seconds > 0 ? ({ seconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL } as const) : null,
    });
  } catch {
    return null;
  }
}

async function cancelNotification(id: string | null) {
  if (!id || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Best-effort.
  }
}

export default function RestTimerScreen() {
  const router = useRouter();
  const { seconds: initialSecondsParam } = useLocalSearchParams<{ seconds?: string }>();
  const initialDuration = Number(initialSecondsParam) > 0 ? Number(initialSecondsParam) : 90;

  const [duration, setDuration] = useState(initialDuration);
  const [remaining, setRemaining] = useState(initialDuration);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      void cancelNotification(notificationIdRef.current);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          successFeedback();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  async function handleStartPause() {
    tapFeedback();
    if (running) {
      setRunning(false);
      await cancelNotification(notificationIdRef.current);
      notificationIdRef.current = null;
    } else {
      if (remaining <= 0) setRemaining(duration);
      setRunning(true);
      notificationIdRef.current = await scheduleRestDoneNotification(remaining > 0 ? remaining : duration);
    }
  }

  function handleReset() {
    tapFeedback();
    setRunning(false);
    setRemaining(duration);
    void cancelNotification(notificationIdRef.current);
    notificationIdRef.current = null;
  }

  function handlePreset(secs: number) {
    tapFeedback();
    setRunning(false);
    void cancelNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    setDuration(secs);
    setRemaining(secs);
  }

  function adjust(delta: number) {
    tapFeedback();
    setRemaining((prev) => Math.max(0, prev + delta));
    setDuration((prev) => Math.max(0, prev + delta));
  }

  const pct = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
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
            <Ionicons name={running ? "pause" : "play"} size={28} color={Color.goldForeground} />
          </Pressable>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.presetsWrap}>
          <Text style={styles.presetsLabel}>PRESETS</Text>
          <View style={styles.presetsRow}>
            {PRESETS.map((p) => (
              <Pressable key={p} onPress={() => handlePreset(p)} style={[styles.presetChip, duration === p && styles.presetChipActive]}>
                <Text style={[styles.presetChipText, duration === p && styles.presetChipTextActive]}>
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
