import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

import { Color } from "@/constants/theme";
import type { ExerciseTrendPoint } from "@/lib/workout-formatters";

const CHART_W = 340;
const CHART_H = 130;
const PAD = { top: 20, right: 12, bottom: 26, left: 30 };

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

// RN/SVG port of the web app's TrendChart.tsx — same layout and data
// selection (weight if any point has one, else reps), rendered fully drawn
// immediately rather than animating in on scroll (no IntersectionObserver
// equivalent worth building for a single chart per screen).
export function TrendChart({ points }: { points: ExerciseTrendPoint[] }) {
  const useWeight = points.some((p) => p.weightNum !== null);
  const chartPoints = useWeight ? points.filter((p) => p.weightNum !== null) : points.filter((p) => p.reps !== null);

  if (chartPoints.length < 2) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Not enough data to show a trend yet.</Text>
      </View>
    );
  }

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const yVals = chartPoints.map((p) => (useWeight ? (p.weightNum as number) : (p.reps as number)));
  const minY = Math.min(...yVals);
  const maxY = Math.max(...yVals);
  const yRange = maxY === minY ? 1 : maxY - minY;

  const toX = (i: number) => PAD.left + (chartPoints.length === 1 ? innerW / 2 : (i / (chartPoints.length - 1)) * innerW);
  const toY = (val: number) => PAD.top + innerH - ((val - minY) / yRange) * innerH;

  const plotted = chartPoints.map((p, i) => {
    const yVal = useWeight ? (p.weightNum as number) : (p.reps as number);
    return {
      x: toX(i),
      y: toY(yVal),
      label: useWeight ? p.rawWeight ?? "" : String(p.reps ?? ""),
      date: p.date,
    };
  });

  const labelStep = Math.max(1, Math.ceil(chartPoints.length / 5));

  return (
    <Svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke={Color.textMuted} strokeOpacity={0.2} strokeWidth={1} />
      <Line
        x1={PAD.left}
        y1={PAD.top + innerH}
        x2={PAD.left + innerW}
        y2={PAD.top + innerH}
        stroke={Color.textMuted}
        strokeOpacity={0.2}
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
        <View key={i}>
          <Circle cx={p.x} cy={p.y} r={3.5} fill={Color.gold} />
          <SvgText x={p.x} y={p.y - 8} fontSize={8} fill={Color.textSecondary} textAnchor="middle">
            {p.label}
          </SvgText>
          {i % labelStep === 0 ? (
            <SvgText x={p.x} y={PAD.top + innerH + 14} fontSize={8} fill={Color.textFaint} textAnchor="middle">
              {shortDate(p.date)}
            </SvgText>
          ) : null}
        </View>
      ))}
      <SvgText x={PAD.left - 4} y={PAD.top + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {maxY}
      </SvgText>
      <SvgText x={PAD.left - 4} y={PAD.top + innerH + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {minY}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { paddingVertical: 24, alignItems: "center" },
  emptyText: { fontSize: 12, color: Color.textMuted },
});
