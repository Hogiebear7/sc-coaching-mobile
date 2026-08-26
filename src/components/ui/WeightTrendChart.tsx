import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";

import { Color } from "@/constants/theme";
import type { BodyWeightLog } from "@/lib/queries/body-weight";
import { computeTrendStats, movingAverageTrend, type TrendPoint } from "@/lib/workout-formatters";
import { useReduceMotionPref } from "@/lib/use-reduce-motion";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

// A hardcoded width clipped on narrower phones — the card's actual available
// width varies by device, so the chart now measures it via onLayout instead.
// This default is only what shows for the first frame before that measurement
// lands.
const DEFAULT_CHART_W = 300;
const CHART_H = 160;
const PAD = { top: 16, right: 12, bottom: 22, left: 30 };
const GRIDLINE_COUNT = 4;

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

// Two-line weight-over-time chart — a thin "Scale Weight" raw series behind
// a bold circle-marker "Trend Weight" moving average, so single-day noise
// doesn't read as the trend itself. Fades and rises in on mount/data-change
// (respecting reduce-motion) so it reads as a live chart rather than a
// static image, matching the animated feel the rest of the app's data views
// use.
export function WeightTrendChart({ logs }: { logs: BodyWeightLog[] }) {
  const reduceMotion = useReduceMotionPref();
  const anim = useRef(new Animated.Value(0)).current;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const dataKey = sorted.map((l) => `${l.date}:${l.weightKg}`).join("|");
  const [chartW, setChartW] = useState(DEFAULT_CHART_W);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 500,
      useNativeDriver: true,
    }).start();
  }, [dataKey, reduceMotion, anim]);

  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== chartW) setChartW(w);
  }

  if (sorted.length < 2) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Log a couple more check-ins to see your trend.</Text>
      </View>
    );
  }

  const rawPoints: TrendPoint[] = sorted.map((l) => ({ date: l.date, value: l.weightKg }));
  const trendPoints = movingAverageTrend(rawPoints, 7);
  const stats = computeTrendStats(rawPoints);

  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const allVals = [...rawPoints, ...trendPoints].map((p) => p.value);
  const minY = Math.min(...allVals);
  const maxY = Math.max(...allVals);
  const yRange = maxY === minY ? 1 : maxY - minY;

  const toX = (i: number) => PAD.left + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW);
  const toY = (val: number) => PAD.top + innerH - ((val - minY) / yRange) * innerH;

  const rawPlotted = rawPoints.map((p, i) => ({ x: toX(i), y: toY(p.value), date: p.date }));
  const trendPlotted = trendPoints.map((p, i) => ({ x: toX(i), y: toY(p.value), val: p.value, date: p.date }));
  const labelStep = Math.max(1, Math.ceil(sorted.length / 5));
  const markerStep = Math.max(1, Math.ceil(sorted.length / 8));

  const rawSegments = rawPlotted.slice(1).map((p, i) => ({
    x1: rawPlotted[i].x,
    y1: rawPlotted[i].y,
    x2: p.x,
    y2: p.y,
    isGap: daysBetween(rawPlotted[i].date, p.date) > GAP_DAYS,
  }));

  const gridlines = Array.from({ length: GRIDLINE_COUNT + 1 }, (_, i) => PAD.top + (innerH / GRIDLINE_COUNT) * i);

  return (
    <View style={styles.wrap}>
      {stats ? (
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>{stats.average.toFixed(1)} kg</Text>
          </View>
          <View style={styles.statRight}>
            <Text style={styles.statLabel}>Difference</Text>
            <Text style={styles.statValue}>
              {stats.difference === 0 ? "No change" : `${stats.difference > 0 ? "+" : ""}${stats.difference.toFixed(1)} kg`}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: Color.textFaint }]} />
          <Text style={styles.legendText}>Scale Weight</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: Color.gold }]} />
          <Text style={styles.legendText}>Trend Weight</Text>
        </View>
      </View>

      <View style={styles.chartWrap} onLayout={onLayout}>
      <AnimatedSvg
        width={chartW}
        height={CHART_H}
        viewBox={`0 0 ${chartW} ${CHART_H}`}
        style={{
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }}
      >
        {gridlines.map((y, i) => (
          <Line
            key={i}
            x1={PAD.left}
            y1={y}
            x2={PAD.left + innerW}
            y2={y}
            stroke={Color.textFaint}
            strokeOpacity={0.25}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}
        <Line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke={Color.textMuted} strokeOpacity={0.25} strokeWidth={1} />

        <Polyline
          points={rawPlotted.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={Color.textFaint}
          strokeWidth={1.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {rawSegments
          .filter((s) => s.isGap)
          .map((s, i) => (
            <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={Color.textFaint} strokeWidth={1.25} strokeDasharray="3 5" strokeOpacity={0.5} />
          ))}

        <Polyline
          points={trendPlotted.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={Color.gold}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {trendPlotted.map((p, i) =>
          i % markerStep === 0 || i === trendPlotted.length - 1 ? (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={3.5} fill={Color.gold} />
              {i % labelStep === 0 ? (
                <SvgText x={p.x} y={PAD.top + innerH + 14} fontSize={8} fill={Color.textFaint} textAnchor="middle">
                  {shortDate(p.date)}
                </SvgText>
              ) : null}
            </G>
          ) : null
        )}
        <SvgText x={PAD.left - 4} y={PAD.top + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
          {maxY.toFixed(1)}
        </SvgText>
        <SvgText x={PAD.left - 4} y={PAD.top + innerH + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
          {minY.toFixed(1)}
        </SvgText>
      </AnimatedSvg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 12, color: Color.textMuted },
  wrap: { width: "100%" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  statRight: { alignItems: "flex-end" },
  statLabel: { fontSize: 10, fontWeight: "600", color: Color.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 16, fontWeight: "700", color: Color.textPrimary, marginTop: 2, fontVariant: ["tabular-nums"] },
  legendRow: { flexDirection: "row", gap: 14, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Color.textMuted },
  chartWrap: { width: "100%", alignItems: "center", marginTop: 6 },
});
