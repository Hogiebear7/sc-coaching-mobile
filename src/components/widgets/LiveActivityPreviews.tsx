import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { classChipText, clock, workoutElapsedSecs, type ClassActivityState, type WorkoutActivityState } from "@/lib/widgets/live-activity";

// Pictures of the Live Activity (iPhone) and Live Update (Android) presentations, for the Widgets screen. Sizes follow Apple's specifications
// for a 393pt-wide iPhone (compact 52x37, minimal 37, expanded and Lock Screen 371 wide, Lock Screen margin 14) and Android's status chip
// (at most 96dp, always an icon). Dynamic Island backgrounds are always black (Apple doesn't allow a custom one); the Lock Screen uses the
// brand navy, which Apple allows there, with gold as the key colour and white text for legibility.

const BLACK = "#000000";
const NAVY = "#0a1526";
const GOLD = "#e0b866";
const WATER = "#5fb4e8";
const TEXT = "#ffffff";
const MUTED = "rgba(255,255,255,0.62)";

export type LiveKind = { kind: "workout"; state: WorkoutActivityState } | { kind: "class"; state: ClassActivityState };

function resting(s: WorkoutActivityState, nowMs: number) {
  return s.restEndsAtMs !== null && s.restEndsAtMs > nowMs ? Math.ceil((s.restEndsAtMs - nowMs) / 1000) : null;
}

function classTime(c: ClassActivityState) {
  const d = new Date(c.startsAtMs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Compact: one Live Activity running. Leading and trailing either side of the camera, read as one piece of information. */
export function IslandCompact({ live, nowMs }: { live: LiveKind; nowMs: number }) {
  let leading, trailing;
  if (live.kind === "workout") {
    const rest = resting(live.state, nowMs);
    leading = <Ionicons name="barbell" size={18} color={rest !== null ? WATER : GOLD} />;
    trailing = <Text style={[styles.compactText, { color: rest !== null ? WATER : GOLD }]}>{rest !== null ? clock(rest) : clock(workoutElapsedSecs(live.state, nowMs))}</Text>;
  } else {
    leading = <Ionicons name="calendar" size={16} color={GOLD} />;
    trailing = <Text style={[styles.compactText, { color: GOLD }]}>{classChipText(live.state, nowMs)}</Text>;
  }
  return (
    <View style={styles.island}>
      <View style={styles.compactSide}>{leading}</View>
      <View style={styles.camera} />
      <View style={[styles.compactSide, { alignItems: "flex-end" }]}>{trailing}</View>
    </View>
  );
}

/** Minimal: when several Live Activities share the island. Still shows live information, not just a logo. */
export function IslandMinimal({ live, nowMs }: { live: LiveKind; nowMs: number }) {
  const rest = live.kind === "workout" ? resting(live.state, nowMs) : null;
  const text =
    live.kind === "workout" ? (rest !== null ? `${rest}s` : `${Math.floor(workoutElapsedSecs(live.state, nowMs) / 60)}m`) : classChipText(live.state, nowMs);
  return (
    <View style={styles.minimal}>
      <Text style={[styles.minimalText, { color: rest !== null ? WATER : GOLD }]} numberOfLines={1} adjustsFontSizeToFit>
        {text}
      </Text>
    </View>
  );
}

/** Expanded: touch and hold. The compact layout, enlarged, wrapped close around the camera. */
export function IslandExpanded({ live, nowMs }: { live: LiveKind; nowMs: number }) {
  if (live.kind === "workout") {
    const s = live.state;
    const rest = resting(s, nowMs);
    return (
      <View style={styles.expanded}>
        <View style={styles.expandedTop}>
          <View style={styles.row}>
            <Ionicons name="barbell" size={20} color={GOLD} />
            <Text style={styles.expandedTitle} numberOfLines={1}>
              {s.title}
            </Text>
          </View>
          <Text style={[styles.expandedTimer, { color: GOLD }]}>{clock(workoutElapsedSecs(s, nowMs))}</Text>
        </View>
        {rest !== null ? (
          <View style={styles.restRow}>
            <Text style={[styles.restLabel]}>Rest</Text>
            <View style={styles.restTrack}>
              <View style={[styles.restFill, { width: `${Math.min(100, (rest / 90) * 100)}%` }]} />
            </View>
            <Text style={[styles.restTime]}>{clock(rest)}</Text>
          </View>
        ) : null}
        <Text style={styles.expandedSub} numberOfLines={1}>
          {s.setsDone} sets done{s.currentExercise ? ` · ${s.currentExercise}` : ""}
        </Text>
      </View>
    );
  }
  const c = live.state;
  return (
    <View style={styles.expanded}>
      <View style={styles.expandedTop}>
        <View style={styles.row}>
          <Ionicons name="calendar" size={18} color={GOLD} />
          <Text style={styles.expandedTitle} numberOfLines={1}>
            {c.title}
          </Text>
        </View>
        <Text style={[styles.expandedTimer, { color: GOLD }]}>{classChipText(c, nowMs)}</Text>
      </View>
      <Text style={styles.expandedSub}>
        Starts at {classTime(c)} · {c.durationMins} min
      </Text>
    </View>
  );
}

/** Lock Screen banner: the expanded layout's information, with the S&C mark (no container) and the 14pt standard margin. */
export function LockScreenActivity({ live, nowMs }: { live: LiveKind; nowMs: number }) {
  const workout = live.kind === "workout" ? live.state : null;
  const rest = workout ? resting(workout, nowMs) : null;
  return (
    <View style={styles.lock}>
      <View style={styles.expandedTop}>
        <View style={styles.row}>
          <Text style={styles.mark}>S&amp;C</Text>
          <Text style={styles.lockTitle} numberOfLines={1}>
            {workout ? workout.title : live.state.title}
          </Text>
        </View>
        <Text style={[styles.lockTimer, rest !== null && { color: WATER }]}>
          {workout ? (rest !== null ? clock(rest) : clock(workoutElapsedSecs(workout, nowMs))) : classChipText(live.state as ClassActivityState, nowMs)}
        </Text>
      </View>
      <Text style={styles.lockSub} numberOfLines={1}>
        {workout
          ? rest !== null
            ? `Resting · ${clock(workoutElapsedSecs(workout, nowMs))} total · ${workout.setsDone} sets`
            : `${workout.setsDone} sets done${workout.currentExercise ? ` · ${workout.currentExercise}` : ""}`
          : `Starts at ${classTime(live.state as ClassActivityState)} · ${(live.state as ClassActivityState).durationMins} min`}
      </Text>
      {live.kind === "class" ? (
        <View style={styles.lockTrack}>
          <View style={[styles.lockFill, { width: `${Math.max(0, Math.min(100, 100 - ((live.state.startsAtMs - nowMs) / 3_600_000) * 100))}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

/** Android: the status-bar chip (icon plus short text, at most 96dp) and the promoted Live Update card at the top of the shade. */
export function AndroidLiveUpdate({ live, nowMs }: { live: LiveKind; nowMs: number }) {
  const workout = live.kind === "workout" ? live.state : null;
  const rest = workout ? resting(workout, nowMs) : null;
  const chip = workout ? (rest !== null ? clock(rest) : clock(workoutElapsedSecs(workout, nowMs))) : classChipText(live.state as ClassActivityState, nowMs);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.statusBar}>
        <View style={styles.chip}>
          <Ionicons name={workout ? "barbell" : "calendar"} size={13} color={NAVY} />
          <Text style={styles.chipText} numberOfLines={1}>
            {chip}
          </Text>
        </View>
        <Text style={styles.statusTime}>12:30</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name={workout ? "barbell" : "calendar"} size={14} color={GOLD} />
          <Text style={styles.cardApp}>S&amp;C Coaching · {workout ? "now" : `starts ${classTime(live.state as ClassActivityState)}`}</Text>
        </View>
        <Text style={styles.cardTitle}>{workout ? workout.title : live.state.title}</Text>
        <Text style={styles.cardText} numberOfLines={1}>
          {workout
            ? `${clock(workoutElapsedSecs(workout, nowMs))} · ${workout.setsDone} sets${rest !== null ? ` · rest ${clock(rest)}` : workout.currentExercise ? ` · ${workout.currentExercise}` : ""}`
            : `Starts in ${classChipText(live.state as ClassActivityState, nowMs)} · ${(live.state as ClassActivityState).durationMins} min`}
        </Text>
        {live.kind === "class" ? (
          <View style={styles.cardTrack}>
            <View style={[styles.cardFill, { width: `${Math.max(0, Math.min(100, 100 - ((live.state.startsAtMs - nowMs) / 3_600_000) * 100))}%` }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  island: { width: 250, height: 37, borderRadius: 18.5, backgroundColor: BLACK, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, alignSelf: "center" },
  compactSide: { width: 62, justifyContent: "center" },
  camera: { flex: 1 },
  compactText: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  minimal: { width: 37, height: 37, borderRadius: 18.5, backgroundColor: BLACK, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  minimalText: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  expanded: { width: 371, maxWidth: "100%", borderRadius: 44, backgroundColor: BLACK, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 18, gap: 8, alignSelf: "center" },
  expandedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  expandedTitle: { color: TEXT, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  expandedTimer: { fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
  expandedSub: { color: MUTED, fontSize: 14, fontWeight: "500" },
  restRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  restLabel: { color: WATER, fontSize: 13, fontWeight: "700" },
  restTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  restFill: { height: 6, borderRadius: 3, backgroundColor: WATER },
  restTime: { color: WATER, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  lock: { width: 371, maxWidth: "100%", borderRadius: 22, backgroundColor: NAVY, padding: 14, gap: 6, alignSelf: "center" },
  mark: { color: GOLD, fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  lockTitle: { color: TEXT, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  lockTimer: { color: GOLD, fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
  lockSub: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "500" },
  lockTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden", marginTop: 2 },
  lockFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  statusBar: { height: 28, borderRadius: 14, backgroundColor: "#1b1b1f", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 8, height: 22, maxWidth: 96 },
  chipText: { color: NAVY, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statusTime: { color: TEXT, fontSize: 12, fontWeight: "600" },
  card: { backgroundColor: "#2b2a30", borderRadius: 24, padding: 16, gap: 4 },
  cardApp: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: "600" },
  cardText: { color: "rgba(255,255,255,0.75)", fontSize: 14 },
  cardTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden", marginTop: 6 },
  cardFill: { height: 4, borderRadius: 2, backgroundColor: GOLD },
});
