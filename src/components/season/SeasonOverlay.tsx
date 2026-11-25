import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";

import { SeasonGround } from "@/components/season/seasonScenes";
import { SnowField } from "@/components/season/SnowField";
import { useSeason } from "@/lib/season";

// Falling snow (see SnowField), a drift along the bottom of the screen, and (1 and 2 January) a New Year burst of fireworks, drawn over the Home screen. Light on purpose: about
// 30 flakes on the native animation thread, never takes a touch, switches off for people who reduce motion on their phone, and stays off when the member turns
// "Seasonal effects" off in Settings or the server says there is no season.
const fireworksPlayed: Record<string, boolean> = {};
let reduceMotionCache = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotionCache = v;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
  reduceMotionCache = v;
});

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

function Fireworks({ width, height, surface }: { width: number; height: number; surface: string }) {
  // Each screen plays them once per app launch.
  const [active] = useState(() => {
    if (fireworksPlayed[surface]) return false;
    fireworksPlayed[surface] = true;
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

export function SeasonOverlay({ surface = "home" }: { surface?: "home" | "community" | "splash" }) {
  const { season, overlay, greeting } = useSeason();
  const { width, height } = Dimensions.get("window");

  if (!season) return null;
  // The Community screen only gets the Christmas / New Year and Halloween looks (owner, 2026-11-17).
  if (surface === "community" && season.key !== "christmas" && season.key !== "halloween") return null;
  const reduceMotion = reduceMotionCache;
  // Only snow falls (owner, 2026-11-17: no falling hearts, shamrocks, eggs or leaves). Everything else is a calm scene along the bottom.
  const falling = season.particle === "snow";
  const message = overlay ? "Happy New Year" : greeting;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {falling && !reduceMotion ? <SnowField width={width} height={height} /> : null}
      {overlay?.fireworks && !reduceMotion ? <Fireworks width={width} height={height} surface={surface} /> : null}
      {surface === "splash" && message ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: height * 0.62, alignItems: "center" }}>
          <Text style={{ color: "#e3b341", fontSize: 30, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center" }}>{message}</Text>
        </View>
      ) : null}
      <SeasonGround season={overlay ? "christmas" : season.key} />
    </View>
  );
}
