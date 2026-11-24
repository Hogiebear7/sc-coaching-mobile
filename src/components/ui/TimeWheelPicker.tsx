import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles } from "@/lib/theme";
import { columnLabelAt, columnValue, flingStep, stepTotal, type WheelColumnSpec } from "@/lib/wheel-math";

const ITEM_HEIGHT = 40;
// One row above, one below the selected row (a dim value peeking in on either side of the bright selected one). One more sits just outside each edge
// so a row is already there as the wheel moves.
const PADDING_ROWS = 1;
const OFFSETS = [-2, -1, 0, 1, 2];

/** A flick under this speed (rows per millisecond) just settles; over it, the wheel keeps spinning and slows down. */
const FLING_MIN_SPEED = 0.004;
/** The wheel is considered stopped below this speed. */
const FLING_STOP_SPEED = 0.0012;

/**
 * One wheel. It follows the finger smoothly (rows slide, they don't jump), keeps spinning after a flick in proportion to how hard it was flicked, then
 * settles on a row. `onStep(delta)` moves the shared total by whole rows and says whether that was allowed (false at the ends, which stops the spin).
 */
function WheelColumn({
  display,
  labelAt,
  max,
  onStep,
  label,
}: {
  display: number;
  labelAt: (offset: number) => string;
  max: number;
  onStep: (delta: number) => boolean;
  label: string;
}) {
  const styles = useStyles();
  const stepRef = useRef(onStep);
  useEffect(() => {
    stepRef.current = onStep;
  });

  const [offsetY] = useState(() => new Animated.Value(0));
  const accum = useRef(0); // rows moved since the wheel was mounted, as a fraction
  const stepped = useRef(0); // whole rows already applied to the total
  const dragStart = useRef(0);
  const raf = useRef<number | null>(null);
  const lastTick = useRef(0);
  const lastHaptic = useRef(0);

  function stopMotion() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }
  useEffect(() => stopMotion, []);

  // Applies whole rows to the total and shows the leftover fraction as a slide. False when the end of the range was hit.
  function apply(): boolean {
    const target = Math.round(accum.current);
    let blocked = false;
    while (stepped.current < target && !blocked) {
      if (stepRef.current(1)) stepped.current += 1;
      else blocked = true;
    }
    while (stepped.current > target && !blocked) {
      if (stepRef.current(-1)) stepped.current -= 1;
      else blocked = true;
    }
    if (blocked) accum.current = stepped.current;
    offsetY.setValue(-(accum.current - stepped.current) * ITEM_HEIGHT);
    return !blocked;
  }

  function haptic() {
    const now = Date.now();
    if (now - lastHaptic.current > 45) {
      lastHaptic.current = now;
      tapFeedback();
    }
  }

  function settle() {
    stopMotion();
    lastTick.current = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(48, now - lastTick.current);
      lastTick.current = now;
      accum.current += (stepped.current - accum.current) * Math.min(1, dt / 70);
      offsetY.setValue(-(accum.current - stepped.current) * ITEM_HEIGHT);
      if (Math.abs(accum.current - stepped.current) < 0.01) {
        accum.current = stepped.current;
        offsetY.setValue(0);
        raf.current = null;
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  function fling(initialSpeed: number) {
    stopMotion();
    let speed = initialSpeed;
    lastTick.current = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(48, now - lastTick.current);
      lastTick.current = now;
      const step = flingStep(speed, dt);
      speed = step.speed;
      const before = stepped.current;
      accum.current += step.distance;
      const ok = apply();
      if (stepped.current !== before) haptic();
      if (!ok || Math.abs(speed) < FLING_STOP_SPEED) {
        settle();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  // Dragging is handled here rather than by a scrolling list, so it follows the finger the same way on every phone.
  // The handlers only read the refs when a touch happens, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        stopMotion();
        dragStart.current = accum.current;
      },
      onPanResponderMove: (_e, g) => {
        const before = stepped.current;
        accum.current = dragStart.current + -g.dy / ITEM_HEIGHT;
        apply();
        if (stepped.current !== before) haptic();
      },
      onPanResponderRelease: (_e, g) => {
        // g.vy is px per ms, negative when flicked up, which moves the value up.
        const speed = -g.vy / ITEM_HEIGHT;
        if (Math.abs(speed) >= FLING_MIN_SPEED) fling(speed);
        else settle();
      },
      onPanResponderTerminate: () => settle(),
    })
  );

  return (
    <View style={styles.column}>
      <View
        style={styles.viewport}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: display }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (stepRef.current(e.nativeEvent.actionName === "increment" ? 1 : -1)) tapFeedback();
        }}
      >
        <Animated.View style={{ marginTop: -ITEM_HEIGHT, transform: [{ translateY: offsetY }] }} pointerEvents="none">
          {OFFSETS.map((k) => (
            <View key={k} style={styles.row}>
              <Text style={[styles.rowText, k === 0 && styles.rowTextActive]}>{labelAt(k)}</Text>
            </View>
          ))}
        </Animated.View>
        <View pointerEvents="none" style={styles.selectionFrame} />
      </View>
      <Text style={styles.columnLabel}>{label}</Text>
    </View>
  );
}

/** Moves the shared total by one column's unit, carrying across columns. Reads the newest total from a ref so a fast spin never works from a stale one. */
function useTotalMover(totalSecs: number, maxTotal: number, onChange: (totalSecs: number) => void) {
  const total = useRef(totalSecs);
  useEffect(() => {
    total.current = totalSecs;
  }, [totalSecs]);
  return (spec: WheelColumnSpec) => (delta: number) => {
    const next = stepTotal(total.current, spec, delta, maxTotal);
    if (next === null) return false;
    total.current = next;
    onChange(next);
    return true;
  };
}

function ClockWheel({ totalSecs, onChange }: { totalSecs: number; onChange: (totalSecs: number) => void }) {
  const styles = useStyles();
  const maxTotal = 23 * 3600 + 59 * 60;
  const move = useTotalMover(totalSecs, maxTotal, onChange);
  const hours: WheelColumnSpec = { unit: 3600, wrapAt: null };
  const minutes: WheelColumnSpec = { unit: 60, wrapAt: 60 };
  const nudge = (deltaMins: number) => onChange(Math.max(0, Math.min(maxTotal, totalSecs + deltaMins * 60)));
  return (
    <View>
      <View style={styles.wrap}>
        <WheelColumn display={columnValue(totalSecs, hours)} labelAt={(k) => columnLabelAt(totalSecs, hours, k, maxTotal)} max={23} label="hour" onStep={move(hours)} />
        <Text style={styles.colon}>:</Text>
        <WheelColumn display={columnValue(totalSecs, minutes)} labelAt={(k) => columnLabelAt(totalSecs, minutes, k, maxTotal)} max={59} label="min" onStep={move(minutes)} />
      </View>
      <View style={styles.nudgeRow}>
        {[-60, -15, 15, 60].map((d) => (
          <Pressable
            key={d}
            onPress={() => {
              tapFeedback();
              nudge(d);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${d < 0 ? "Earlier by" : "Later by"} ${Math.abs(d)} minutes`}
            style={styles.nudge}
          >
            <Text style={styles.nudgeText}>
              {d < 0 ? "−" : "+"}
              {Math.abs(d) === 60 ? "1h" : "15m"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * A scroll-wheel duration picker — three columns (h/min/sec) or two
 * (min/sec) with the current value centered and highlighted, matching the
 * native Android/iOS clock app's own timer-setup picker. `showHours` off
 * (the default) is what a single exercise's set duration uses; the
 * full-screen rest timer's custom-duration entry turns it on.
 * Seconds past 59 carry into the minutes (and minutes into hours), and back down the same way.
 */
export function TimeWheelPicker({
  totalSecs,
  onChange,
  showHours = false,
  maxHours = 23,
  clock = false,
}: {
  totalSecs: number;
  onChange: (totalSecs: number) => void;
  showHours?: boolean;
  maxHours?: number;
  /** Pick a time of day: hours (0-23) and minutes, no seconds. `totalSecs` is seconds since midnight. */
  clock?: boolean;
}) {
  const styles = useStyles();
  const maxTotal = (showHours ? maxHours * 3600 : 0) + 59 * 60 + 59;
  const move = useTotalMover(totalSecs, maxTotal, onChange);
  if (clock) return <ClockWheel totalSecs={totalSecs} onChange={onChange} />;

  const hoursSpec: WheelColumnSpec = { unit: 3600, wrapAt: null };
  const minutesSpec: WheelColumnSpec = { unit: 60, wrapAt: showHours ? 60 : null };
  const secondsSpec: WheelColumnSpec = { unit: 1, wrapAt: 60 };
  const nudge = (delta: number) => onChange(Math.max(0, Math.min(maxTotal, totalSecs + delta)));

  return (
    <View>
    <View style={styles.wrap}>
      {showHours ? (
        <>
          <WheelColumn display={columnValue(totalSecs, hoursSpec)} labelAt={(k) => columnLabelAt(totalSecs, hoursSpec, k, maxTotal)} max={maxHours} label="h" onStep={move(hoursSpec)} />
          <Text style={styles.colon}>:</Text>
        </>
      ) : null}
      <WheelColumn display={columnValue(totalSecs, minutesSpec)} labelAt={(k) => columnLabelAt(totalSecs, minutesSpec, k, maxTotal)} max={59} label="min" onStep={move(minutesSpec)} />
      <Text style={styles.colon}>:</Text>
      <WheelColumn display={columnValue(totalSecs, secondsSpec)} labelAt={(k) => columnLabelAt(totalSecs, secondsSpec, k, maxTotal)} max={59} label="sec" onStep={move(secondsSpec)} />
    </View>
    <View style={styles.nudgeRow}>
      {[-60, -15, 15, 60].map((d) => (
        <Pressable
          key={d}
          onPress={() => {
            tapFeedback();
            nudge(d);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${d < 0 ? "Take off" : "Add"} ${Math.abs(d)} seconds`}
          style={styles.nudge}
        >
          <Text style={styles.nudgeText}>{d < 0 ? "−" : "+"}{Math.abs(d) === 60 ? "1m" : "15s"}</Text>
        </Pressable>
      ))}
    </View>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    nudgeRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: Spacing.md },
    nudge: { minWidth: 56, minHeight: 40, paddingHorizontal: 10, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: Color.surface2 },
    nudgeText: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
    wrap: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
    column: { alignItems: "center", width: 64 },
    viewport: { height: ITEM_HEIGHT * (PADDING_ROWS * 2 + 1), width: "100%", overflow: "hidden" },
    row: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
    rowText: { fontSize: 20, fontWeight: "600", color: Color.textFaint, fontVariant: ["tabular-nums"] },
    rowTextActive: { fontSize: 24, fontWeight: "700", color: Color.gold },
    selectionFrame: {
      position: "absolute",
      left: 4,
      right: 4,
      top: ITEM_HEIGHT * PADDING_ROWS,
      height: ITEM_HEIGHT,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: Color.goldBorder,
    },
    columnLabel: { fontSize: 14, fontWeight: "600", color: Color.textMuted, marginTop: Spacing.xs },
    colon: { fontSize: 20, fontWeight: "700", color: Color.textFaint, marginTop: ITEM_HEIGHT * PADDING_ROWS + (ITEM_HEIGHT - 20) / 2 - 4 },
  })
);
