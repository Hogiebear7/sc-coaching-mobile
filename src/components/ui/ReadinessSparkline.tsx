import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, G, Polyline } from "react-native-svg";

import { Color } from "@/constants/theme";
import { sparklineSegments } from "@/lib/readiness-formatters";

const W = 112;
const H = 40;
// Plotted points can land exactly on the W/H edges (most recent day's dot
// sits at cx=W, a 0 or 100 reading sits at cy=H or cy=0), and the endpoint
// dot's radius extends past that — without padding, the SVG canvas clips
// it in half. Pad the canvas and shift the plot inward instead of touching
// sparklineSegments' coordinate math.
const PAD = 4;
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// react-native-svg's Polyline doesn't support the SVG2 `pathLength`
// normalization trick the web version uses, so the dash length has to be
// the polyline's actual pixel length instead of a fixed 100.
function polylineLength(points: string): number {
  const coords = points.split(" ").map((p) => p.split(",").map(Number));
  let length = 0;
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    length += Math.hypot(x2 - x1, y2 - y1);
  }
  return length;
}

// Compact 14-day readiness trend — ported from the web dashboard's
// ReadinessSparkline (app/(dashboard)/dashboard/page.tsx), gaps stay gaps
// rather than interpolating across days with no check-in. Draws itself in
// over ~1.2s on mount using the same pathLength-normalized dashoffset trick
// as the web version's CSS animation, just driven by RN Animated instead.
export function ReadinessSparkline({ series }: { series: (number | null)[] }) {
  const segments = sparklineSegments(series, W, H);
  const lastIdx = series.length - 1 - [...series].reverse().findIndex((v) => v !== null);
  const lastVal = lastIdx >= 0 ? series[lastIdx] : null;
  const stepX = series.length > 1 ? W / (series.length - 1) : 0;

  const draw = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    draw.setValue(0);
    dotOpacity.setValue(0);
    Animated.timing(draw, { toValue: 1, duration: 1200, useNativeDriver: false }).start();
    Animated.timing(dotOpacity, { toValue: 1, duration: 300, delay: 1000, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.join(",")]);

  if (segments.length === 0) return null;

  return (
    <View>
      <Svg width={W + PAD * 2} height={H + PAD * 2} viewBox={`0 0 ${W + PAD * 2} ${H + PAD * 2}`}>
        <G transform={`translate(${PAD}, ${PAD})`}>
          {segments.map((points, i) =>
            points.includes(" ") ? (
              <AnimatedPolyline
                key={i}
                points={points}
                strokeDasharray={`${polylineLength(points)}`}
                strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [polylineLength(points), 0] })}
                fill="none"
                stroke={Color.accentData}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ) : (
              <Circle
                key={i}
                cx={Number(points.split(",")[0])}
                cy={Number(points.split(",")[1])}
                r={1.5}
                fill={Color.accentData}
                opacity={0.7}
              />
            )
          )}
          {lastVal !== null ? (
            <AnimatedCircle
              cx={lastIdx * stepX}
              cy={H - (lastVal / 100) * H}
              r={3}
              fill={Color.gold}
              opacity={dotOpacity}
            />
          ) : null}
        </G>
      </Svg>
    </View>
  );
}
