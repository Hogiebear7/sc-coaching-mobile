import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Color } from "@/constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Ported 1:1 from the web app's ReadinessRing (components/ui/ReadinessRing.tsx)
// — same bands (success >=60, data 40-59, warning <40), same stroke/radius
// math. react-native-svg doesn't support CSS drop-shadow filters, so the
// glow is approximated with a second, wider, low-opacity stroke underneath.
// Unlike the (static) web version, the ring fills in from empty over ~1.2s
// on mount rather than snapping straight to its resting position.
export function ReadinessRing({ score, size = 76 }: { score: number | null; size?: number }) {
  const stroke = 6;
  // The glow stroke is wider than the base ring (stroke + 5), so it extends
  // past a size x size canvas and gets clipped at the edges. Draw into a
  // larger canvas centered on the same box so the glow has room to bleed.
  const glowPad = 6;
  const svgSize = size + glowPad * 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color =
    score === null ? "#7a7f8c" : score >= 60 ? Color.success : score >= 40 ? Color.accentData : Color.warning;

  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fill.setValue(0);
    Animated.timing(fill, { toValue: pct, duration: 1200, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const dashoffset = fill.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={svgSize}
        height={svgSize}
        style={{ position: "absolute", left: -glowPad, top: -glowPad, transform: [{ rotate: "-90deg" }] }}
      >
        <Circle cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        {score !== null && (
          <>
            <AnimatedCircle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeOpacity={0.35}
              strokeWidth={stroke + 5}
              strokeLinecap="round"
              strokeDasharray={`${c}, ${c}`}
              strokeDashoffset={dashoffset}
            />
            <AnimatedCircle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c}, ${c}`}
              strokeDashoffset={dashoffset}
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
