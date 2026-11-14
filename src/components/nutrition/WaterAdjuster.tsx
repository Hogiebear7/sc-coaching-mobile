import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { LIQUID_BOTTLE_BODY_H, LiquidBottle } from "@/components/ui/LiquidBottle";
import { Segmented } from "@/components/ui/Segmented";
import { AppRadius } from "@/constants/theme";
import { selectionFeedback, successFeedback } from "@/lib/haptics";
import { insideRect, onTouch, type Rect } from "@/lib/outside-touch";
import { makeStyles, useAppTheme } from "@/lib/theme";
import {
  bottleDeltaFromDrag,
  clampPending,
  dialDeltaFromDrag,
  FALLBACK_GOAL_ML,
  formatSignedMl,
  totalAfter,
  WATER_STEP_ML,
} from "@/lib/water-adjust";

// Adjusting the day's water by dragging, instead of typing a total.
//
// Tap the bottle (or the dial) to switch dragging on. Drag as often as you like: lifting your finger does not save, so a slip of the thumb can
// be put right. A dashed line marks where the day started. Tap anywhere else to save (or leave the screen). Dragging back to the dashed line
// changes nothing. The +250 / +500 / +750 buttons stay as they were.

type Mode = "bottle" | "dial";
const MODE_KEY = "water-control-mode-v1";

// Layout of the bottle (see LiquidBottle): a cap and neck above the body, which is the part the water fills.
const BOTTLE_TOP_OFFSET = 9 + 14;

const DIAL_W = 150;
const DIAL_H = 180;
const DIAL = { cx: -105, cy: 90, r: 190, degPerStep: 3.5, maxDeg: 27.5 };

// The drag handlers live outside the component, the same way the tab swipe does in app/(tabs)/_layout.tsx: a PanResponder is made once and
// reads what it needs from this object, which the mounted card keeps up to date. There is only ever one water card on screen.
const adj = {
  mode: "bottle" as Mode,
  armed: false,
  pending: 0,
  start: 0,
  logged: 0,
  goal: null as number | null,
  share: 1,
  setPending: (_next: number) => {},
};

const waterPan = PanResponder.create({
  onStartShouldSetPanResponderCapture: () => adj.armed,
  onMoveShouldSetPanResponderCapture: () => adj.armed,
  onPanResponderGrant: () => {
    adj.start = adj.pending;
  },
  onPanResponderMove: (_e, g) => {
    const delta =
      adj.mode === "bottle"
        ? bottleDeltaFromDrag(g.dy, LIQUID_BOTTLE_BODY_H, adj.goal ?? FALLBACK_GOAL_ML)
        : dialDeltaFromDrag(g.dy);
    const next = clampPending(adj.start + delta, adj.logged, adj.share);
    if (next !== adj.pending) {
      adj.pending = next;
      adj.setPending(next);
      selectionFeedback();
    }
  },
  onPanResponderTerminationRequest: () => false,
});

export function WaterAdjuster({
  loggedMl,
  targetMl,
  share,
  drinkLabel,
  reduceMotion,
  statusText,
  noTargetText,
  onSave,
}: {
  loggedMl: number;
  targetMl: number | null;
  /** How much of the picked drink counts as water, 0 to 1. */
  share: number;
  drinkLabel: string;
  reduceMotion: boolean;
  statusText: string | null;
  noTargetText: string;
  /** Called with the day's new total, in water-equivalent millilitres. */
  onSave: (totalMl: number) => void;
}) {
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();

  const [mode, setMode] = useState<Mode>("bottle");
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(0);

  const startPending = useRef(0);
  const controlRect = useRef<Rect | null>(null);
  const bottleRef = useRef<View>(null);
  const dialRef = useRef<View>(null);
  const onSaveRef = useRef(onSave);

  // Keep what the drag handlers read up to date.
  useEffect(() => {
    adj.mode = mode;
    adj.armed = armed;
    adj.logged = loggedMl;
    adj.goal = targetMl;
    adj.share = share;
    onSaveRef.current = onSave;
  }, [mode, armed, loggedMl, targetMl, share, onSave]);
  useEffect(() => {
    adj.setPending = setPending;
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((v) => {
        if (v === "bottle" || v === "dial") setMode(v);
      })
      .catch(() => {});
  }, []);

  const canAdjust = !!targetMl && targetMl > 0;

  const measureActive = useCallback((which: Mode) => {
    const node = which === "bottle" ? bottleRef.current : dialRef.current;
    node?.measureInWindow((x, y, width, height) => {
      controlRect.current = { x, y, width, height };
    });
  }, []);

  const arm = useCallback(() => {
    if (!canAdjust || adj.armed) return;
    selectionFeedback();
    startPending.current = 0;
    adj.armed = true;
    adj.pending = 0;
    setPending(0);
    setArmed(true);
    measureActive(adj.mode);
  }, [canAdjust, measureActive]);

  const finish = useCallback(() => {
    if (!adj.armed) return;
    const p = adj.pending;
    const logged = adj.logged;
    const s = adj.share;
    adj.armed = false;
    adj.pending = 0;
    setArmed(false);
    setPending(0);
    startPending.current = 0;
    if (p !== 0) {
      successFeedback();
      onSaveRef.current(totalAfter(logged, p, s));
    }
  }, []);

  const cancel = useCallback(() => {
    adj.armed = false;
    adj.pending = 0;
    setArmed(false);
    setPending(0);
    startPending.current = 0;
  }, []);

  // Tap anywhere outside the control that is switched on: save.
  useEffect(() => {
    if (!armed) return undefined;
    return onTouch((x, y) => {
      const rect = controlRect.current;
      if (!rect || !insideRect(x, y, rect)) finish();
    });
  }, [armed, finish]);

  // Leaving the screen with a change still unsaved saves it rather than losing it.
  useFocusEffect(
    useCallback(() => {
      return () => finish();
    }, [finish])
  );

  function chooseMode(next: Mode) {
    finish();
    setMode(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }

  const shown = totalAfter(loggedMl, pending, share);
  const goal = targetMl && targetMl > 0 ? targetMl : 0;
  const fillPct = goal > 0 ? Math.max(0, Math.min(100, (shown / goal) * 100)) : 0;
  const startPct = goal > 0 ? Math.max(0, Math.min(100, (loggedMl / goal) * 100)) : 0;
  const showStartLine = armed && pending !== 0 && goal > 0;
  const startLineTop = BOTTLE_TOP_OFFSET + LIQUID_BOTTLE_BODY_H * (1 - startPct / 100);

  return (
    <View>
      <View style={[styles.row, mode === "dial" ? styles.rowDial : null]}>
        <View
          ref={bottleRef}
          collapsable={false}
          style={[styles.bottleWrap, armed && mode === "bottle" ? { borderColor: dc.hydration } : null]}
          {...(mode === "bottle" ? waterPan.panHandlers : {})}
        >
          <Pressable
            onPress={mode === "bottle" ? arm : undefined}
            disabled={mode !== "bottle" || !canAdjust}
            accessibilityRole="adjustable"
            accessibilityLabel={`Water today, ${(shown / 1000).toFixed(2)} litres`}
            accessibilityHint={canAdjust ? "Double tap to switch on adjusting, then drag up to add or down to take away" : undefined}
          >
            <LiquidBottle fillPct={fillPct} reduceMotion={reduceMotion} />
          </Pressable>
          {showStartLine ? (
            <View pointerEvents="none" style={[styles.startLine, { top: startLineTop }]}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={styles.startDash} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.side, mode === "dial" ? styles.sideDial : null]}>
          {armed ? (
            <Text style={styles.delta}>{formatSignedMl(pending)}</Text>
          ) : goal > 0 ? (
            <Text style={styles.sideText}>{statusText}</Text>
          ) : (
            <Text style={styles.emptyText}>{noTargetText}</Text>
          )}
          {armed && goal > 0 ? <Text style={styles.sideText}>{statusTextFor(goal, shown)}</Text> : null}
          {mode === "dial" ? (
            <View
              ref={dialRef}
              collapsable={false}
              style={[styles.dialWrap, !armed ? styles.dialIdle : null]}
              {...waterPan.panHandlers}
            >
              <Pressable onPress={arm} disabled={!canAdjust} accessibilityRole="adjustable" accessibilityLabel="Amount to add or take away, in millilitres">
                <Dial pending={pending} color={colors.text} accent={dc.hydration} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.helpRow}>
        <Text style={styles.help}>
          {!canAdjust
            ? ""
            : armed
              ? mode === "bottle"
                ? `Drag the water up to add ${drinkLabel.toLowerCase()}, down to take away. Tap anywhere else to save.`
                : `Drag the dial down to add ${drinkLabel.toLowerCase()}, up to take away. Tap anywhere else to save.`
              : mode === "bottle"
                ? "Tap the bottle to adjust."
                : "Tap the dial to adjust."}
        </Text>
        {armed ? (
          <Pressable onPress={cancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel changes" style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>

      {canAdjust ? (
        <View style={styles.modeRow}>
          <Segmented<Mode>
            options={["bottle", "dial"]}
            value={mode}
            onChange={chooseMode}
            format={(m) => (m === "bottle" ? "Drag bottle" : "Dial")}
          />
        </View>
      ) : null}
    </View>
  );
}

function statusTextFor(goalMl: number, shownMl: number): string {
  const diff = goalMl - shownMl;
  const litres = Math.round(Math.abs(diff) / 100) / 10;
  if (diff > 0) return `${litres.toFixed(1)}L remaining today`;
  if (litres === 0) return "Target hit.";
  return `Target hit, ${litres.toFixed(1)}L over.`;
}

// The curved number line: down adds, up takes away. The numbers slide past a pointer as the finger moves.
function Dial({ pending, color, accent }: { pending: number; color: string; accent: string }) {
  const { cx, cy, r, degPerStep, maxDeg } = DIAL;
  const from = Math.floor((pending - 450) / WATER_STEP_ML) * WATER_STEP_ML;
  const to = Math.ceil((pending + 450) / WATER_STEP_ML) * WATER_STEP_ML;
  const marks: React.ReactNode[] = [];
  for (let v = from; v <= to; v += WATER_STEP_ML) {
    const deg = -((v - pending) / WATER_STEP_ML) * degPerStep;
    if (Math.abs(deg) > maxDeg) continue;
    const a = (deg * Math.PI) / 180;
    const major = v % 250 === 0;
    const len = major ? 14 : 7;
    const fade = 1 - Math.abs(deg) / 36;
    const x1 = cx + r * Math.cos(a);
    const y1 = cy + r * Math.sin(a);
    const x2 = cx + (r - len) * Math.cos(a);
    const y2 = cy + (r - len) * Math.sin(a);
    marks.push(<Line key={`l${v}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={fade * (major ? 0.9 : 0.45)} strokeWidth={major ? 2 : 1.5} />);
    if (major) {
      const tx = cx + (r - 21) * Math.cos(a);
      const ty = cy + (r - 21) * Math.sin(a);
      marks.push(
        <SvgText key={`t${v}`} x={tx} y={ty + 4} fill={color} fillOpacity={fade * 0.8} fontSize={12} textAnchor="end">
          {v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`}
        </SvgText>
      );
    }
  }
  return (
    <Svg width={DIAL_W} height={DIAL_H}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={1.5} />
      {marks}
      <Polygon points={`${DIAL_W - 57},${cy} ${DIAL_W - 43},${cy - 7} ${DIAL_W - 43},${cy + 7}`} fill={accent} />
    </Svg>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 16 },
    rowDial: { alignItems: "flex-end" },
    bottleWrap: { borderRadius: 24, borderWidth: 2, borderColor: "transparent", padding: 2, position: "relative" },
    startLine: { position: "absolute", left: 2, right: 2, height: 2, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 },
    startDash: { width: 6, height: 2, backgroundColor: c.text, opacity: 0.7 },
    side: { flex: 1, gap: 4 },
    sideDial: { alignItems: "flex-start", justifyContent: "flex-end" },
    sideText: { fontSize: 17, color: c.textSecondary },
    emptyText: { fontSize: 14, color: c.textMuted },
    delta: { fontSize: 26, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    dialWrap: { borderRadius: AppRadius.inner, marginTop: 4 },
    dialIdle: { opacity: 0.5 },
    helpRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, minHeight: 20 },
    help: { flex: 1, fontSize: 14, color: c.textSecondary },
    cancel: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10 },
    cancelText: { fontSize: 14, fontWeight: "600", color: c.text, textDecorationLine: "underline" },
    modeRow: { marginTop: 12 },
  })
);
