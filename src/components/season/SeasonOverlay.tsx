import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { useSeason } from "@/lib/season";

// Falling snow, a drift along the bottom of the screen, and (1 and 2 January) a New Year burst of fireworks, drawn over the Home screen. Light on purpose: about
// 26 flakes on the native animation thread, never takes a touch, switches off for people who reduce motion on their phone, and stays off when the member turns
// "Seasonal effects" off in Settings or the server says there is no season.
const FLAKES = 26;
let fireworksPlayedThisLaunch = false;
let reduceMotionCache = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotionCache = v;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
  reduceMotionCache = v;
});

// A little six-armed crystal, for the odd real snowflake among the round ones.
function Crystal({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20">
      {[0, 60, 120].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Line key={a} x1={Math.cos(r) * -9} y1={Math.sin(r) * -9} x2={Math.cos(r) * 9} y2={Math.sin(r) * 9} stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" />;
      })}
    </Svg>
  );
}

function Flake({ index, width, height }: { index: number; width: number; height: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const spec = useMemo(() => {
    // Spread flakes with a repeatable pseudo-random layout so they don't clump.
    const r = (n: number) => ((Math.sin(index * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return { x: r(1) * width, crystal: index % 3 === 0, size: 3 + r(2) * 4, duration: 7000 + r(3) * 7000, delay: r(4) * 7000, sway: 10 + r(5) * 22, opacity: 0.55 + r(6) * 0.4 };
  }, [index, width]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: spec.duration, delay: spec.delay, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, spec]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: spec.x,
        top: 0,
        width: spec.crystal ? spec.size * 3.4 : spec.size,
        height: spec.crystal ? spec.size * 3.4 : spec.size,
        borderRadius: spec.crystal ? 0 : spec.size / 2,
        backgroundColor: spec.crystal ? "transparent" : "#ffffff",
        opacity: spec.opacity,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, height + 12] }) },
          { translateX: progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, spec.sway, 0, -spec.sway, 0] }) },
        ],
      }}
    >
      {spec.crystal ? <Crystal size={spec.size * 3.4} /> : null}
    </Animated.View>
  );
}

function Spark({ cx, cy, angle, distance, color, delay }: { cx: number; cy: number; angle: number; distance: number; color: string; delay: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration: 1700, delay, easing: Easing.out(Easing.quad), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance + 24] }) },
        ],
      }}
    />
  );
}

function Fireworks({ width, height }: { width: number; height: number }) {
  const [active] = useState(() => {
    if (fireworksPlayedThisLaunch) return false;
    fireworksPlayedThisLaunch = true;
    return true;
  });
  const COLOURS = ["#e3b341", "#ffffff", "#5ea0ff", "#f4d57a"];
  const bursts = useMemo(
    () =>
      Array.from({ length: 9 }, (_, b) => ({
        cx: width * (0.12 + ((b * 0.29) % 0.76)),
        cy: height * (0.1 + ((b * 0.19) % 0.4)),
        color: COLOURS[b % COLOURS.length],
        delay: b * 380,
      })),
    [width, height] // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!active) return null;
  return (
    <>
      {bursts.flatMap((burst, b) =>
        Array.from({ length: 24 }, (_, i) => (
          <Spark key={`${b}-${i}`} cx={burst.cx} cy={burst.cy} angle={(i / 24) * Math.PI * 2} distance={70 + (i % 3) * 26} color={burst.color} delay={burst.delay} />
        ))
      )}
    </>
  );
}

export function SeasonOverlay() {
  const { season, overlay } = useSeason();
  const { width, height } = Dimensions.get("window");

  if (!season) return null;
  const reduceMotion = reduceMotionCache;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {season.particle === "snow" && !reduceMotion
        ? Array.from({ length: FLAKES }, (_, i) => <Flake key={i} index={i} width={width} height={height} />)
        : null}
      {overlay?.fireworks && !reduceMotion ? <Fireworks width={width} height={height} /> : null}
      {season.pile ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 30 }}>
          <Svg width="100%" height="100%" viewBox="0 0 400 30" preserveAspectRatio="none">
            <Path d="M0 30 L0 15 C30 6 60 18 100 12 C140 6 170 18 210 12 C250 6 280 18 320 12 C350 8 380 14 400 16 L400 30 Z" fill="#f4f8ff" />
            <Path d="M0 30 L0 23 C40 19 80 26 130 22 C180 18 230 26 280 22 C330 18 370 24 400 24 L400 30 Z" fill="#dce8f7" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}
