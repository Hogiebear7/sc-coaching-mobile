import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
  const scrollRef = useRef<ScrollView>(null);
  const suppressNextSync = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const values = Array.from({ length: max + 1 }, (_, i) => i);
  // The settle timer fires later, so it must read the newest value and callback rather than the ones from the render that started it.
  const offsetY = useRef(value * ITEM_HEIGHT);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });

  // Keep the scroll position synced when `value` changes from outside this
  // column (a reset, or the parent clamping an out-of-range value) — but
  // not right after this column's own scroll just set it, or the sync
  // would fight the native snap that's already mid-flight.
  useEffect(() => {
    if (suppressNextSync.current) {
      suppressNextSync.current = false;
      return;
    }
    // Only move the list when it is not already showing this value, so a change that came from scrolling never scrolls it back.
    if (Math.round(offsetY.current / ITEM_HEIGHT) === value) return;
    offsetY.current = value * ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: false });
  }, [value]);

  // Opening inside a modal, the first scrollTo can run before the list has a size: place it again once it has laid out.
  const placeAtValue = () => {
    offsetY.current = latest.current.value * ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y: offsetY.current, animated: false });
  };

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  // Takes the offset, not the event: React Native releases a scroll event's
  // nativeEvent once the handler returns, so reading it later (the settle
  // timer below) crashed with "contentOffset of null".
  function commitFromOffset(offsetY: number) {
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(max, index));
    if (clamped !== latest.current.value) {
      suppressNextSync.current = true;
      tapFeedback();
      latest.current.onChange(clamped);
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
          onMomentumScrollEnd={(e) => commitFromOffset(e.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(e) => {
            // A slow drag that never picks up momentum doesn't always fire
            // onMomentumScrollEnd on every platform — this catches that
            // case too; if momentum does follow, it just re-confirms the
            // same index onChange already no-ops against.
            if (e.nativeEvent.velocity && Math.abs(e.nativeEvent.velocity.y) < 0.05) commitFromOffset(e.nativeEvent.contentOffset.y);
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
            const y = e.nativeEvent.contentOffset.y;
            offsetY.current = y;
            // Commit only once the list has been still for a moment (not mid-drag), whichever input device was used.
            if (settleTimer.current) clearTimeout(settleTimer.current);
            settleTimer.current = setTimeout(() => commitFromOffset(offsetY.current), 250);
          }}
          nestedScrollEnabled
          overScrollMode="never"
          scrollEventThrottle={16}
          onContentSizeChange={placeAtValue}
          onLayout={placeAtValue}
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
