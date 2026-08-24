import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Color, MacroColor, Spacing } from "@/constants/theme";

const SIZE = 116;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

// Calories per gram — proportions are drawn by calorie contribution, not raw
// grams, since a gram of fat (9 kcal) isn't the same "slice" of the day as a
// gram of protein or carbs (4 kcal each). Grams are what's shown in the
// legend and labels; calories are only used to size the arcs correctly.
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export type MacroKind = "protein" | "carbs" | "fat";

export interface MacroPieChartProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
  onSlicePress: (macro: MacroKind) => void;
}

// Donut chart for the day's logged protein/carbs/fat split, colour-coded and
// tappable per slice (matches the legend below it, which shares the same
// onSlicePress handler for anyone who taps the text instead of the ring).
// Calories stay in the existing text above this in the hero card — this
// component is purely the macro split, not a second place showing the total.
export function MacroPieChart({ proteinG, carbsG, fatG, onSlicePress }: MacroPieChartProps) {
  const proteinKcal = proteinG * KCAL_PER_G.protein;
  const carbsKcal = carbsG * KCAL_PER_G.carbs;
  const fatKcal = fatG * KCAL_PER_G.fat;
  const totalKcal = proteinKcal + carbsKcal + fatKcal;

  const hasData = totalKcal > 0;
  const segments: { kind: MacroKind; kcal: number; color: string }[] = [
    { kind: "protein", kcal: proteinKcal, color: MacroColor.protein },
    { kind: "carbs", kcal: carbsKcal, color: MacroColor.carbs },
    { kind: "fat", kcal: fatKcal, color: MacroColor.fat },
  ];

  let cumulative = 0;

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={Color.surface2} strokeWidth={STROKE} />
      {hasData
        ? segments.map((s) => {
            if (s.kcal <= 0) return null;
            const fraction = s.kcal / totalKcal;
            const dash = fraction * CIRCUMFERENCE;
            const offset = -cumulative * CIRCUMFERENCE;
            cumulative += fraction;
            return (
              <Circle
                key={s.kind}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                onPress={() => onSlicePress(s.kind)}
              />
            );
          })
        : null}
    </Svg>
  );
}

// Colour-coded legend rows shown beside/below the pie — same tap target as
// the ring itself, plus the exact gram numbers a pie alone can't show.
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
