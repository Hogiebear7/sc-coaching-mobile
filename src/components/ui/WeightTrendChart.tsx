import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from "react-native-svg";

import { Color } from "@/constants/theme";
import type { BodyWeightLog } from "@/lib/queries/body-weight";
import { useReduceMotionPref } from "@/lib/use-reduce-motion";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const CHART_W = 340;
const CHART_H = 130;
const PAD = { top: 20, right: 12, bottom: 22, left: 28 };

// Consecutive entries more than this far apart get a dashed connector so a
// long logging gap reads as a gap, not a steady trend — mirrors the web
// profile page's body-weight chart (ProfileForm.tsx, BW_GAP_DAYS).
const GAP_DAYS = 35;

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000;
}

// Plain weight-over-time line — separate from TrendChart (exercise weight/
// reps) since body-weight logs are a simpler {date, weightKg} shape. Fades
// and rises in on mount/data-change (respecting reduce-motion) so it reads
// as a live chart rather than a static image, matching the animated feel
// the rest of the app's data views use.
export function WeightTrendChart({ logs }: { logs: BodyWeightLog[] }) {
  const reduceMotion = useReduceMotionPref();
  const anim = useRef(new Animated.Value(0)).current;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const dataKey = sorted.map((l) => `${l.date}:${l.weightKg}`).join("|");

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 500,
      useNativeDriver: true,
    }).start();
  }, [dataKey, reduceMotion, anim]);

  if (sorted.length < 2) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Log a couple more check-ins to see your trend.</Text>
      </View>
    );
  }

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const weights = sorted.map((l) => l.weightKg);
  const minY = Math.min(...weights);
  const maxY = Math.max(...weights);
  const yRange = maxY === minY ? 1 : maxY - minY;

  const toX = (i: number) => PAD.left + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW);
  const toY = (val: number) => PAD.top + innerH - ((val - minY) / yRange) * innerH;

  const plotted = sorted.map((l, i) => ({ x: toX(i), y: toY(l.weightKg), val: l.weightKg, date: l.date }));
  const labelStep = Math.max(1, Math.ceil(sorted.length / 5));

  const segments = plotted.slice(1).map((p, i) => ({
    x1: plotted[i].x,
    y1: plotted[i].y,
    x2: p.x,
    y2: p.y,
    isGap: daysBetween(plotted[i].date, p.date) > GAP_DAYS,
  }));

  const areaPoints = [
    `${plotted[0].x},${PAD.top + innerH}`,
    ...plotted.map((p) => `${p.x},${p.y}`),
    `${plotted[plotted.length - 1].x},${PAD.top + innerH}`,
  ].join(" ");

  return (
    <AnimatedSvg
      width={CHART_W}
      height={CHART_H}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke={Color.textMuted} strokeOpacity={0.2} strokeWidth={1} />
      <Line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke={Color.textMuted} strokeOpacity={0.2} strokeWidth={1} />
      <Polygon points={areaPoints} fill={Color.gold} fillOpacity={0.1} />
      {segments.map((s, i) => (
        <Line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={Color.gold}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={s.isGap ? "3 5" : undefined}
          strokeOpacity={s.isGap ? 0.55 : 1}
        />
      ))}
      {plotted.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={3} fill={Color.gold} />
          <SvgText x={p.x} y={p.y - 8} fontSize={8} fill={Color.textMuted} textAnchor="middle">
            {p.val}
          </SvgText>
          {i % labelStep === 0 ? (
            <SvgText x={p.x} y={PAD.top + innerH + 14} fontSize={8} fill={Color.textFaint} textAnchor="middle">
              {shortDate(p.date)}
            </SvgText>
          ) : null}
        </G>
      ))}
      <SvgText x={PAD.left - 4} y={PAD.top + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {maxY.toFixed(1)}
      </SvgText>
      <SvgText x={PAD.left - 4} y={PAD.top + innerH + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {minY.toFixed(1)}
      </SvgText>
    </AnimatedSvg>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 12, color: Color.textMuted },
});
