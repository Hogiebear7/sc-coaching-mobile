import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Color } from "@/constants/theme";

// Ported 1:1 from the web app's ReadinessRing (components/ui/ReadinessRing.tsx)
// — same bands (success >=60, data 40-59, warning <40), same stroke/radius
// math. react-native-svg doesn't support CSS drop-shadow filters, so the
// glow is approximated with a second, wider, low-opacity stroke underneath.
export function ReadinessRing({ score, size = 76 }: { score: number | null; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color =
    score === null ? "#7a7f8c" : score >= 60 ? Color.success : score >= 40 ? Color.accentData : Color.warning;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        {score !== null && (
          <>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeOpacity={0.35}
              strokeWidth={stroke + 5}
              strokeLinecap="round"
              strokeDasharray={`${c}, ${c}`}
              strokeDashoffset={c * (1 - pct)}
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c}, ${c}`}
              strokeDashoffset={c * (1 - pct)}
            />
          </>
        )}
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <Text style={styles.value}>{score ?? "—"}</Text>
          <Text style={styles.suffix}>/100</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 20,
    lineHeight: 22,
    color: Color.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  suffix: {
    fontSize: 9,
    fontWeight: "500",
    color: Color.textMuted,
    marginTop: 1,
  },
});
