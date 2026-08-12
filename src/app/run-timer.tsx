import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { formatDuration } from "@/lib/workout-formatters";
import { useWorkoutDraft } from "@/lib/workout-draft";

// A focused stopwatch for a run entry: Start/Pause/Lap/Reset, timestamp-based
// so elapsed time stays correct if the screen re-renders mid-run. "Save to
// run" writes the total duration and recorded splits back into the matching
// run row on the shared workout draft, then returns to Log Workout.
export default function RunTimerScreen() {
  const router = useRouter();
  const { runKey } = useLocalSearchParams<{ runKey: string }>();
  const { draft, update } = useWorkoutDraft();

  const [accumulatedSecs, setAccumulatedSecs] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [splits, setSplits] = useState<string[]>([]);

  function elapsedSecs(): number {
    if (!startedAtMs) return accumulatedSecs;
    return accumulatedSecs + Math.floor((Date.now() - startedAtMs) / 1000);
  }

  // The displayed clock is driven by this state, refreshed every second
  // while running — reading elapsedSecs() directly in JSX doesn't reliably
  // repaint, since its Date.now() read isn't a dependency React can see.
  const [liveElapsedSecs, setLiveElapsedSecs] = useState(0);
  useEffect(() => {
    setLiveElapsedSecs(elapsedSecs());
    if (!startedAtMs) return;
    const id = setInterval(() => setLiveElapsedSecs(elapsedSecs()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAtMs, accumulatedSecs]);

  function handleStartPause() {
    tapFeedback();
    if (startedAtMs) {
      setAccumulatedSecs(elapsedSecs());
      setStartedAtMs(null);
    } else {
      setStartedAtMs(Date.now());
    }
  }

  function handleLap() {
    tapFeedback();
    setSplits((prev) => [...prev, formatDuration(elapsedSecs())]);
  }

  function handleReset() {
    tapFeedback();
    setStartedAtMs(null);
    setAccumulatedSecs(0);
    setSplits([]);
  }

  function handleSaveToRun() {
    tapFeedback();
    const total = elapsedSecs();
    const run = draft.runRows.find((r) => r.key === runKey);
    if (run) {
      update({
        runRows: draft.runRows.map((r) =>
          r.key === runKey ? { ...r, duration: formatDuration(total), splits: [...r.splits, ...splits] } : r
        ),
      });
    }
    router.back();
  }

  const running = startedAtMs !== null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Run Timer</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.clock}>{formatDuration(liveElapsedSecs)}</Text>

        <View style={styles.controlsRow}>
          <Pressable onPress={handleReset} style={styles.secondaryControl}>
            <Ionicons name="refresh" size={20} color={Color.textSecondary} />
          </Pressable>
          <Pressable onPress={handleStartPause} style={styles.primaryControl}>
            <Ionicons name={running ? "pause" : "play"} size={28} color={Color.goldForeground} />
          </Pressable>
          <Pressable onPress={handleLap} style={styles.secondaryControl} disabled={!running}>
            <Ionicons name="flag-outline" size={20} color={running ? Color.textSecondary : Color.textFaint} />
          </Pressable>
        </View>

        {splits.length > 0 ? (
          <View style={styles.splitsCard}>
            <Text style={styles.splitsTitle}>SPLITS</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {splits.map((s, i) => (
                <View key={i} style={styles.splitRow}>
                  <Text style={styles.splitIndex}>Lap {i + 1}</Text>
                  <Text style={styles.splitTime}>{s}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Button title="Save to run" onPress={handleSaveToRun} style={{ marginTop: Spacing.xl, alignSelf: "stretch" }} />
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
  body: { flex: 1, alignItems: "center", paddingTop: Spacing.xxl, paddingHorizontal: Spacing.lg },
  clock: { fontSize: 56, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xl, marginTop: Spacing.xl },
  secondaryControl: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Color.borderSubtle },
  primaryControl: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: Color.gold },
  splitsCard: {
    width: "100%",
    marginTop: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.md,
  },
  splitsTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  splitRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Color.borderSubtle },
  splitIndex: { fontSize: 13, color: Color.textMuted },
  splitTime: { fontSize: 13, fontWeight: "600", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
});
