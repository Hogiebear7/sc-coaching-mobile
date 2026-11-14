import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles } from "@/lib/theme";

const ITEM_HEIGHT = 40;
// One row above, one below the selected row — matches the 3-row wheel look
// (a dim value peeking in on either side of the bright selected one).
const PADDING_ROWS = 1;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function WheelColumn({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const styles = useStyles();
  // The newest value and callback, for touch handlers that outlive the render that created them.
  const latest = useRef({ value, onChange, max });
  useEffect(() => {
    latest.current = { value, onChange, max };
  });
  const startValue = useRef(0);
  const flingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopFling() {
    if (flingTimer.current) clearInterval(flingTimer.current);
    flingTimer.current = null;
  }
  function moveTo(next: number) {
    const { value: current, onChange: change, max: top } = latest.current;
    const clamped = Math.max(0, Math.min(top, next));
    if (clamped !== current) {
      tapFeedback();
      change(clamped);
    }
  }
  useEffect(() => stopFling, []);

  // Dragging is handled here rather than by a scrolling list, so it follows the finger the same way on every phone: every ITEM_HEIGHT of
  // movement is one step, and a flick carries on for a moment before it settles.
  // The handlers only read the refs when a touch happens, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        stopFling();
        startValue.current = latest.current.value;
      },
      onPanResponderMove: (_e, g) => {
        moveTo(startValue.current + Math.round(-g.dy / ITEM_HEIGHT));
      },
      onPanResponderRelease: (_e, g) => {
        // Release speed in px/ms (negative = flicked up, so the value goes up).
        let speed = -g.vy;
        if (Math.abs(speed) < 0.5) return;
        stopFling();
        flingTimer.current = setInterval(() => {
          moveTo(latest.current.value + (speed > 0 ? 1 : -1));
          speed *= 0.82;
          if (Math.abs(speed) < 0.35) stopFling();
        }, 60);
      },
      onPanResponderTerminate: () => stopFling(),
    })
  );

  const rows = [value - 1, value, value + 1];
  return (
    <View style={styles.column}>
      <View style={styles.viewport} {...pan.panHandlers} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: value }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => moveTo(latest.current.value + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
      >
        {rows.map((v, i) => (
          <View key={i} style={styles.row} pointerEvents="none">
            <Text style={[styles.rowText, i === 1 && styles.rowTextActive]}>{v >= 0 && v <= max ? pad(v) : ""}</Text>
          </View>
        ))}
        <View pointerEvents="none" style={styles.selectionFrame} />
      </View>
      <Text style={styles.columnLabel}>{label}</Text>
    </View>
  );
}

/**
 * A scroll-wheel duration picker — three columns (h/min/sec) or two
 * (min/sec) with the current value centered and highlighted, matching the
 * native Android/iOS clock app's own timer-setup picker. `showHours` off
 * (the default) is what a single exercise's set duration uses; the
 * full-screen rest timer's custom-duration entry turns it on.
 */
export function TimeWheelPicker({
  totalSecs,
  onChange,
  showHours = false,
  maxHours = 23,
}: {
  totalSecs: number;
  onChange: (totalSecs: number) => void;
  showHours?: boolean;
  maxHours?: number;
}) {
  const styles = useStyles();
  const h = showHours ? Math.floor(totalSecs / 3600) : 0;
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const maxTotal = (showHours ? maxHours * 3600 : 0) + 59 * 60 + 59;
  const nudge = (delta: number) => onChange(Math.max(0, Math.min(maxTotal, totalSecs + delta)));

  return (
    <View>
    <View style={styles.wrap}>
      {showHours ? (
        <>
          <WheelColumn value={h} max={maxHours} label="h" onChange={(v) => onChange(v * 3600 + m * 60 + s)} />
          <Text style={styles.colon}>:</Text>
        </>
      ) : null}
      <WheelColumn value={m} max={59} label="min" onChange={(v) => onChange(h * 3600 + v * 60 + s)} />
      <Text style={styles.colon}>:</Text>
      <WheelColumn value={s} max={59} label="sec" onChange={(v) => onChange(h * 3600 + m * 60 + v)} />
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
