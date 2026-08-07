import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

import { Color } from "@/constants/theme";
import type { BodyWeightLog } from "@/lib/queries/body-weight";

const CHART_W = 340;
const CHART_H = 110;
const PAD = { top: 16, right: 12, bottom: 22, left: 34 };

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

// Plain weight-over-time line — separate from TrendChart (exercise weight/
// reps) since body-weight logs are a simpler {date, weightKg} shape.
export function WeightTrendChart({ logs }: { logs: BodyWeightLog[] }) {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

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

  const plotted = sorted.map((l, i) => ({ x: toX(i), y: toY(l.weightKg), date: l.date }));
  const labelStep = Math.max(1, Math.ceil(sorted.length / 5));

  return (
    <Svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke={Color.textMuted} strokeOpacity={0.2} strokeWidth={1} />
      <Line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke={Color.textMuted} strokeOpacity={0.2} strokeWidth={1} />
      <Polyline
        points={plotted.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={Color.accentData}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {plotted.map((p, i) => (
        <View key={i}>
          <Circle cx={p.x} cy={p.y} r={3} fill={Color.accentData} />
          {i % labelStep === 0 ? (
            <SvgText x={p.x} y={PAD.top + innerH + 14} fontSize={8} fill={Color.textFaint} textAnchor="middle">
              {shortDate(p.date)}
            </SvgText>
          ) : null}
        </View>
      ))}
      <SvgText x={PAD.left - 4} y={PAD.top + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {maxY.toFixed(1)}
      </SvgText>
      <SvgText x={PAD.left - 4} y={PAD.top + innerH + 3} fontSize={8} fill={Color.textFaint} textAnchor="end">
        {minY.toFixed(1)}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 12, color: Color.textMuted },
});
