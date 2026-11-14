import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { figure, Radius, Spacing } from "@/constants/theme";
import { celebrateFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import {
  HYROX_LAPS,
  hyroxClock,
  hyroxElapsed,
  hyroxLap,
  hyroxPause,
  hyroxResult,
  hyroxSegments,
  hyroxSplits,
  hyroxStart,
  hyroxSummaryNote,
  hyroxUndoLap,
} from "@/lib/hyrox";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { useTickingValue } from "@/lib/use-ticker";
import { useWorkoutDraft } from "@/lib/workout-draft";

// The live Hyrox screen: one overall clock, and a lap at the end of every run and station. The last station's lap stops the clock and ends the
// race. Everything is kept in the workout draft, so leaving the screen (or the app) never loses the race.

export default function HyroxScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { draft, update } = useWorkoutDraft();
  const config = draft.hyroxConfig;
  const session = draft.hyroxSession;
  const segments = hyroxSegments(config);
  const splits = hyroxSplits(session);
  const running = session.startedAtMs !== null;
  const lapIndex = session.lapTotals.length;
  const lapStart = lapIndex === 0 ? 0 : session.lapTotals[lapIndex - 1];
  const total = useTickingValue(() => hyroxElapsed(session, Date.now()), running, 250);
  const current = segments[lapIndex] ?? null;
  const isLast = lapIndex === HYROX_LAPS - 1;
  const paused = session.started && !running && !session.finished;
  const result = hyroxResult(session);

  function commit(next: typeof session) {
    update({ hyroxSession: next, formatResultNote: hyroxSummaryNote(next) });
  }

  function handleStart() {
    tapFeedback();
    commit(hyroxStart(session, Date.now()));
  }
  function handlePause() {
    tapFeedback();
    commit(hyroxPause(session, Date.now()));
  }
  function handleLap() {
    const next = hyroxLap(session, Date.now());
    if (next === session) return;
    if (next.finished) celebrateFeedback();
    else successFeedback();
    commit(next);
  }
  function handleUndo() {
    tapFeedback();
    commit(hyroxUndoLap(session, Date.now()));
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-down" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Hyrox</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.clockBlock}>
        <Text style={styles.clockLabel}>{session.finished ? "Finished" : paused ? "Paused" : "Overall time"}</Text>
        <Text style={styles.clock}>{hyroxClock(session.finished ? result.total : total)}</Text>
      </View>

      {session.finished ? (
        <View style={styles.resultCard}>
          <ResultLine label="Run total" value={hyroxClock(result.runTotal)} />
          <ResultLine label="Stations total" value={hyroxClock(result.stationTotal)} />
          <ResultLine label="Best run lap" value={result.bestRun !== null ? hyroxClock(result.bestRun) : "—"} />
          <Text style={styles.savedHint}>Go back and press Log workout to save every run and station.</Text>
          <Button title="Done" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
        </View>
      ) : current ? (
        <View style={styles.nowCard}>
          <Text style={styles.nowLabel}>{session.started ? "NOW" : "FIRST UP"}</Text>
          <Text style={styles.nowTitle}>{current.kind === "station" ? `${current.stationNumber}. ${current.title}` : current.title}</Text>
          <Text style={styles.nowDetail}>{current.detail}</Text>
          {session.started ? <Text style={styles.lapClock}>{hyroxClock(Math.max(0, total - lapStart))}</Text> : null}
        </View>
      ) : null}

      {session.finished ? null : (
        <View style={styles.controls}>
          {!session.started ? (
            <Pressable onPress={handleStart} accessibilityRole="button" style={styles.bigButton}>
              <Ionicons name="play" size={30} color={Color.goldForeground} />
              <Text style={styles.bigButtonText}>Start</Text>
            </Pressable>
          ) : paused ? (
            <Pressable onPress={handleStart} accessibilityRole="button" style={styles.bigButton}>
              <Ionicons name="play" size={30} color={Color.goldForeground} />
              <Text style={styles.bigButtonText}>Resume</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleLap} accessibilityRole="button" accessibilityLabel={isLast ? "Finish" : "Lap"} style={styles.bigButton}>
              <Ionicons name={isLast ? "flag" : "flag-outline"} size={30} color={Color.goldForeground} />
              <Text style={styles.bigButtonText}>{isLast ? "Finish" : "Lap"}</Text>
            </Pressable>
          )}
          <View style={styles.smallRow}>
            {running ? (
              <Pressable onPress={handlePause} accessibilityRole="button" style={styles.smallButton}>
                <Ionicons name="pause" size={18} color={Color.textPrimary} />
                <Text style={styles.smallText}>Pause</Text>
              </Pressable>
            ) : null}
            {lapIndex > 0 ? (
              <Pressable onPress={handleUndo} accessibilityRole="button" style={styles.smallButton}>
                <Ionicons name="arrow-undo" size={18} color={Color.textPrimary} />
                <Text style={styles.smallText}>Undo last lap</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        {segments.map((seg) => {
          const done = seg.index < lapIndex;
          const here = !session.finished && seg.index === lapIndex;
          return (
            <View key={seg.index} style={[styles.row, here && styles.rowHere, done && styles.rowDone]}>
              <View style={styles.rowNumberWrap}>
                {seg.kind === "station" ? (
                  <View style={styles.stationChip}>
                    <Text style={styles.stationChipText}>{String(seg.stationNumber).padStart(2, "0")}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, seg.kind === "run" && styles.rowTitleRun]}>{seg.title}</Text>
                {seg.detail ? <Text style={styles.rowDetail}>{seg.detail}</Text> : null}
              </View>
              <Text style={styles.rowTime}>{done ? hyroxClock(splits[seg.index]) : here && session.started ? hyroxClock(Math.max(0, total - lapStart)) : "—"}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );

  function ResultLine({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.resultLine}>
        <Text style={styles.resultLabel}>{label}</Text>
        <Text style={styles.resultValue}>{value}</Text>
      </View>
    );
  }
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary },
    clockBlock: { alignItems: "center", paddingTop: Spacing.sm },
    clockLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: Color.textMuted, textTransform: "uppercase" },
    clock: { ...figure(72, "700"), color: Color.gold },
    nowCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Color.surface1, alignItems: "center", gap: 4 },
    nowLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: Color.gold },
    nowTitle: { fontSize: 22, fontWeight: "700", color: Color.textPrimary, textAlign: "center" },
    nowDetail: { fontSize: 15, color: Color.textMuted },
    lapClock: { ...figure(34, "700"), color: Color.textPrimary, marginTop: 4 },
    controls: { alignItems: "center", paddingHorizontal: Spacing.lg, marginTop: Spacing.md, gap: Spacing.sm },
    bigButton: { width: "100%", minHeight: 88, borderRadius: Radius.pill, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
    bigButtonText: { fontSize: 26, fontWeight: "800", color: Color.goldForeground },
    smallRow: { flexDirection: "row", gap: Spacing.sm },
    smallButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: Color.surface2, flexDirection: "row", alignItems: "center", gap: 6 },
    smallText: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    resultCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Color.surface1, gap: 6 },
    resultLine: { flexDirection: "row", justifyContent: "space-between" },
    resultLabel: { fontSize: 15, color: Color.textMuted },
    resultValue: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
    savedHint: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm },
    list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, borderWidth: 2, borderColor: "transparent" },
    rowHere: { borderColor: Color.gold, backgroundColor: Color.surface1 },
    rowDone: { opacity: 0.6 },
    rowNumberWrap: { width: 40, alignItems: "center" },
    stationChip: { minWidth: 34, height: 26, borderRadius: 6, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    stationChipText: { fontSize: 13, fontWeight: "800", color: Color.goldForeground },
    rowTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    rowTitleRun: { fontWeight: "500", color: Color.textSecondary },
    rowDetail: { fontSize: 13, color: Color.textMuted },
    rowTime: { fontSize: 16, fontWeight: "600", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  })
);
