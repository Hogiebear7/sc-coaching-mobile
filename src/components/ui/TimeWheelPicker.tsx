import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";

import { Color, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";

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
  const scrollRef = useRef<ScrollView>(null);
  const suppressNextSync = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const values = Array.from({ length: max + 1 }, (_, i) => i);

  // Keep the scroll position synced when `value` changes from outside this
  // column (a reset, or the parent clamping an out-of-range value) — but
  // not right after this column's own scroll just set it, or the sync
  // would fight the native snap that's already mid-flight.
  useEffect(() => {
    if (suppressNextSync.current) {
      suppressNextSync.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: false });
  }, [value]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  function commitFromOffset(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(max, index));
    if (clamped !== value) {
      suppressNextSync.current = true;
      tapFeedback();
      onChange(clamped);
    }
  }

  return (
    <View style={styles.column}>
      <View style={styles.viewport}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * PADDING_ROWS }}
          onMomentumScrollEnd={commitFromOffset}
          onScrollEndDrag={(e) => {
            // A slow drag that never picks up momentum doesn't always fire
            // onMomentumScrollEnd on every platform — this catches that
            // case too; if momentum does follow, it just re-confirms the
            // same index onChange already no-ops against.
            if (e.nativeEvent.velocity && Math.abs(e.nativeEvent.velocity.y) < 0.05) commitFromOffset(e);
          }}
          // Trackpad/mouse-wheel scrolling (web) doesn't reliably fire
          // onMomentumScrollEnd/onScrollEndDrag the way a touch drag does —
          // the scroll position visibly moves but nothing ever commits it.
          // This is the platform-agnostic fallback: any scroll resets an
          // idle timer, and once scrolling has genuinely stopped for a
          // moment (whatever the input device), commit wherever it settled.
          // Harmless alongside the two handlers above — same clamped index,
          // onChange just no-ops the second time.
          onScroll={(e) => {
            if (settleTimer.current) clearTimeout(settleTimer.current);
            const evt = e;
            settleTimer.current = setTimeout(() => commitFromOffset(evt), 120);
          }}
          scrollEventThrottle={16}
        >
          {values.map((v) => (
            <View key={v} style={styles.row}>
              <Text style={[styles.rowText, v === value && styles.rowTextActive]}>{pad(v)}</Text>
            </View>
          ))}
        </ScrollView>
        {/* Selected-row frame — thin gold rules above/below the center row,
            matching the reference picker's highlighted middle row. Purely
            decorative, so it can't intercept the scroll gesture beneath it. */}
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
  const h = showHours ? Math.floor(totalSecs / 3600) : 0;
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  return (
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
  );
}

const styles = StyleSheet.create({
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
  columnLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xs, textTransform: "uppercase" },
  colon: { fontSize: 20, fontWeight: "700", color: Color.textFaint, marginTop: ITEM_HEIGHT * PADDING_ROWS + (ITEM_HEIGHT - 20) / 2 - 4 },
});
