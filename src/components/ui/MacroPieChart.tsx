import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Color, MacroColor, Spacing } from "@/constants/theme";

const SIZE = 124;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 4;
const GAP_DEG = 3;

// Calories per gram — wedge angles are sized by calorie contribution, not
// raw grams, since a gram of fat (9 kcal) isn't the same "slice" of the
// day's energy as a gram of protein or carbs (4 kcal each).
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export type MacroKind = "protein" | "carbs" | "fat";

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Pie-wedge path (not a ring segment) from startDeg to endDeg at the given
// radius, so a smaller radius draws a smaller copy of the same wedge
// rather than a thinner ring — that's what lets the fill grow from the
// centre point outward as progress increases.
function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (r <= 0) return "";
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export interface MacroPieChartProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  onSlicePress: (macro: MacroKind) => void;
}

// Three target-sized wedges (protein/carbs/fat, by calorie share of the
// day's plan). Each wedge is always fully filled with a faded tint of its
// colour — so the day's planned split is legible even before anything's
// logged, unlike a progress fill that would be a near-invisible sliver at
// low intake — and a second, fully-saturated fill grows from the centre
// point outward on top of that as the member logs food toward that
// macro's target. The wedge's own outline never moves, only how much of
// it reads as "eaten" vs "still faded," so "how much of today's plan is
// this macro" and "how much of that have I actually eaten" read as two
// different things at a glance.
export function MacroPieChart({
  proteinG,
  carbsG,
  fatG,
  targetProteinG,
  targetCarbsG,
  targetFatG,
  onSlicePress,
}: MacroPieChartProps) {
  const targets = {
    protein: (targetProteinG ?? 0) * KCAL_PER_G.protein,
    carbs: (targetCarbsG ?? 0) * KCAL_PER_G.carbs,
    fat: (targetFatG ?? 0) * KCAL_PER_G.fat,
  };
  const totalTargetKcal = targets.protein + targets.carbs + targets.fat;
  // No macro targets set at all (only an overall calorie goal) — fall back
  // to an even three-way split so the chart still has something to show
  // rather than collapsing to nothing.
  const shares =
    totalTargetKcal > 0
      ? { protein: targets.protein / totalTargetKcal, carbs: targets.carbs / totalTargetKcal, fat: targets.fat / totalTargetKcal }
      : { protein: 1 / 3, carbs: 1 / 3, fat: 1 / 3 };

  const consumed = { protein: proteinG, carbs: carbsG, fat: fatG };
  const targetG = { protein: targetProteinG, carbs: targetCarbsG, fat: targetFatG };

  const order: MacroKind[] = ["protein", "carbs", "fat"];
  let cursor = 0;
  const wedges = order.map((kind) => {
    const spanDeg = shares[kind] * 360;
    const startDeg = cursor + GAP_DEG / 2;
    const endDeg = cursor + spanDeg - GAP_DEG / 2;
    cursor += spanDeg;

    const g = targetG[kind];
    const progress = g && g > 0 ? Math.min(1, consumed[kind] / g) : consumed[kind] > 0 ? 1 : 0;
    // A logged amount under ~7% of target rounds to a sub-pixel radius —
    // technically "filled from the centre" but invisible in practice.
    // Floor it to a small dot so any nonzero intake reads as visibly
    // started, without changing how the fill scales above that point.
    const fillRadius = progress > 0 ? Math.max(4, RADIUS * progress) : 0;

    return { kind, startDeg, endDeg, fillRadius, color: MacroColor[kind] };
  });

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Faded backdrop — always the full target-sized wedge, so the
          day's planned split reads clearly even at zero intake. */}
      {wedges.map((w) => (
        <Path
          key={`${w.kind}-backdrop`}
          d={wedgePath(CENTER, CENTER, RADIUS, w.startDeg, w.endDeg)}
          fill={w.color}
          fillOpacity={0.28}
          onPress={() => onSlicePress(w.kind)}
        />
      ))}
      {/* Progress fill — fully saturated, grows from the centre point
          outward as intake approaches the target. */}
      {wedges
        .filter((w) => w.fillRadius > 0)
        .map((w) => (
          <Path
            key={`${w.kind}-fill`}
            d={wedgePath(CENTER, CENTER, w.fillRadius, w.startDeg, w.endDeg)}
            fill={w.color}
            onPress={() => onSlicePress(w.kind)}
          />
        ))}
      {wedges.map((w) => (
        <Path
          key={`${w.kind}-outline`}
          d={wedgePath(CENTER, CENTER, RADIUS, w.startDeg, w.endDeg)}
          fill="none"
          stroke={w.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          onPress={() => onSlicePress(w.kind)}
        />
      ))}
    </Svg>
  );
}

// Colour-coded legend rows shown beside/below the pie — same tap target as
// the wedge itself, plus the exact gram numbers a pie alone can't show.
export function MacroLegendRow({
  kind,
  label,
  consumed,
  target,
  onPress,
}: {
  kind: MacroKind;
  label: string;
  consumed: number;
  target: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.legendRow} hitSlop={4}>
      <View style={[styles.dot, { backgroundColor: MacroColor[kind] }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>
        {consumed}
        {target ? `/${target}g` : "g"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  legendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: Spacing.sm },
  legendLabel: { flex: 1, fontSize: 12.5, fontWeight: "600", color: Color.textSecondary },
  legendValue: { fontSize: 12, color: Color.textMuted, fontVariant: ["tabular-nums"] },
});
