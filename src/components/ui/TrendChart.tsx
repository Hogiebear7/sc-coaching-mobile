import { useState } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";

import { Color, Radius } from "@/constants/theme";
import { computeTrendStats, type TrendPoint } from "@/lib/workout-formatters";

// A hardcoded width clipped on narrower phones — the card's actual available
// width varies by device, so the chart now measures it via onLayout instead.
// This default is only what shows for the first frame before that measurement
// lands.
const DEFAULT_CHART_W = 300;
const CHART_H = 130;
const PAD = { top: 20, right: 12, bottom: 26, left: 30 };
const GRIDLINE_COUNT = 4;
const TOOLTIP_W = 92;

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

// RN/SVG port of the web app's TrendChart.tsx — same layout, rendered fully
// drawn immediately rather than animating in on scroll (no
// IntersectionObserver equivalent worth building for a single chart per
// screen). Metric-agnostic: callers pick what `value`/`label` mean per
// point (weight, reps, volume, sets, 1RM, ...) and how a raw number should
// read in the Average/Difference header via `formatValue`. Touching/dragging
// over the plot area highlights the nearest point in a callout, same
// interaction as WeightTrendChart.
export function TrendChart({ points, formatValue = (v: number) => String(v) }: { points: TrendPoint[]; formatValue?: (v: number) => string }) {
  const [chartW, setChartW] = useState(DEFAULT_CHART_W);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== chartW) setChartW(w);
  }

  if (points.length < 2) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Not enough data to show a trend yet.</Text>
      </View>
    );
  }

  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const yVals = points.map((p) => p.value);
  const minY = Math.min(...yVals);
  const maxY = Math.max(...yVals);
  const yRange = maxY === minY ? 1 : maxY - minY;

  const toX = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const toY = (val: number) => PAD.top + innerH - ((val - minY) / yRange) * innerH;

  const plotted = points.map((p, i) => ({
    x: toX(i),
    y: toY(p.value),
    val: p.value,
    label: p.label ?? String(p.value),
    date: p.date,
  }));

  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  const stats = computeTrendStats(points);
  const gridlines = Array.from({ length: GRIDLINE_COUNT + 1 }, (_, i) => PAD.top + (innerH / GRIDLINE_COUNT) * i);

  function indexFromTouchX(touchX: number): number {
    const clamped = Math.max(PAD.left, Math.min(PAD.left + innerW, touchX));
    const ratio = innerW === 0 ? 0 : (clamped - PAD.left) / innerW;
    const idx = Math.round(ratio * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, idx));
  }

  function handleTouch(e: GestureResponderEvent) {
    setActiveIndex(indexFromTouchX(e.nativeEvent.locationX));
  }

  const activePoint = activeIndex !== null ? plotted[activeIndex] : null;
  const tooltipLeft = activePoint ? Math.max(0, Math.min(chartW - TOOLTIP_W, activePoint.x - TOOLTIP_W / 2)) : 0;
  const tooltipAbove = activePoint ? activePoint.y - PAD.top > 34 : true;

  return (
    <View style={styles.wrap}>
      {stats ? (
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>{formatValue(stats.average)}</Text>
          </View>
          <View style={styles.statRight}>
            <Text style={styles.statLabel}>Difference</Text>
            <Text style={styles.statValue}>
              {stats.difference === 0 ? "No change" : `${stats.difference > 0 ? "+" : "-"}${formatValue(Math.abs(stats.difference))}`}
            </Text>
          </View>
        </View>
      ) : null}
    <View
      style={styles.chartWrap}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
    >
    <Svg width={chartW} height={CHART_H} viewBox={`0 0 ${chartW} ${CHART_H}`}>
      {gridlines.map((y, i) => (
        <Line key={i} x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke={Color.textFaint} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 4" />
      ))}
      <Line
        x1={PAD.left}
        y1={PAD.top + innerH}
        x2={PAD.left + innerW}
        y2={PAD.top + innerH}
        stroke={Color.textMuted}
        strokeOpacity={0.25}
        strokeWidth={1}
      />
      <Polyline
        points={plotted.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={Color.gold}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {plotted.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={3.5} fill={Color.gold} />
          <SvgText x={p.x} y={p.y - 8} fontSize={8} fill={Color.textSecondary} textAnchor="middle">
            {p.label}
          </SvgText>
          {i % labelStep === 0 ? (
            <SvgText x={p.x} y={PAD.top + innerH + 14} fontSize={8} fill={Color.textFaint} textAnchor="middle">
              {shortDate(p.date)}
            </SvgText>
          ) : null}
        </G>
      ))}
      <SvgText x={PAD.left - 4} y={PAD.top + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {maxY}
      </SvgText>
      <SvgText x={PAD.left - 4} y={PAD.top + innerH + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {minY}
      </SvgText>

      {activePoint ? (
        <G>
          <Line x1={activePoint.x} y1={PAD.top} x2={activePoint.x} y2={PAD.top + innerH} stroke={Color.textPrimary} strokeOpacity={0.3} strokeWidth={1} />
          <Circle cx={activePoint.x} cy={activePoint.y} r={4.5} fill={Color.bg0} stroke={Color.textPrimary} strokeWidth={2} />
        </G>
      ) : null}
    </Svg>

    {activePoint ? (
      <View
        pointerEvents="none"
        style={[
          styles.tooltip,
          {
            left: tooltipLeft,
            top: tooltipAbove ? activePoint.y - 46 : activePoint.y + 10,
          },
        ]}
      >
        <Text style={styles.tooltipValue}>{formatValue(activePoint.val)}</Text>
        <Text style={styles.tooltipDate}>{shortDate(activePoint.date)}</Text>
      </View>
    ) : null}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { paddingVertical: 24, alignItems: "center" },
  emptyText: { fontSize: 12, color: Color.textMuted },
  wrap: { width: "100%" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  statRight: { alignItems: "flex-end" },
  statLabel: { fontSize: 10, fontWeight: "600", color: Color.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 16, fontWeight: "700", color: Color.textPrimary, marginTop: 2, fontVariant: ["tabular-nums"] },
  chartWrap: { width: "100%", alignItems: "center", marginTop: 6 },
  tooltip: {
    position: "absolute",
    width: TOOLTIP_W,
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface2,
  },
  tooltipValue: { fontSize: 12, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  tooltipDate: { fontSize: 9, color: Color.textMuted, marginTop: 1 },
});
