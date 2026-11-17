import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { SPRITE_COLOURS, Sprite, type SpriteKind } from "@/components/season/seasonArt";
import { SeasonGround } from "@/components/season/seasonScenes";
import { SPLASH_MESSAGES, useSeason, type Particle } from "@/lib/season";

// Falling snow, a drift along the bottom of the screen, and (1 and 2 January) a New Year burst of fireworks, drawn over the Home screen. Light on purpose: about
// 26 flakes on the native animation thread, never takes a touch, switches off for people who reduce motion on their phone, and stays off when the member turns
// "Seasonal effects" off in Settings or the server says there is no season.
const FLAKES = 26;
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

const SPRITE_FOR: Partial<Record<Particle, SpriteKind>> = { hearts: "heart", shamrocks: "shamrock", eggs: "egg", leaves: "leaf" };

function Flake({ index, width, height, particle }: { index: number; width: number; height: number; particle: Particle }) {
  const kind = SPRITE_FOR[particle];
  const [progress] = useState(() => new Animated.Value(0));
  const spec = useMemo(() => {
    // Spread flakes with a repeatable pseudo-random layout so they don't clump.
    const r = (n: number) => ((Math.sin(index * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return { x: r(1) * width, crystal: index % 3 === 0, size: 3 + r(2) * 4, duration: 7000 + r(3) * 7000, delay: r(4) * 7000, sway: 10 + r(5) * 22, opacity: kind ? 0.9 : 0.55 + r(6) * 0.4, spriteSize: 14 + r(7) * 12, colourIndex: Math.floor(r(8) * 5) };
  }, [index, width, kind]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: spec.duration, delay: spec.delay, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, spec]);

  if (kind) {
    const colours = SPRITE_COLOURS[kind];
    return (
      <Animated.View
        style={{
          position: "absolute",
          left: spec.x,
          top: 0,
          opacity: spec.opacity,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-30, height + 30] }) },
            { translateX: progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, spec.sway, 0, -spec.sway, 0] }) },
            { rotate: progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ["-25deg", "25deg", "-25deg", "25deg", "-25deg"] }) },
          ],
        }}
      >
        <Sprite kind={kind} size={spec.spriteSize} color={colours[spec.colourIndex % colours.length]} />
      </Animated.View>
    );
  }

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
  const { season, overlay } = useSeason();
  const { width, height } = Dimensions.get("window");

  if (!season) return null;
  // The Community screen only gets the Christmas / New Year and Halloween looks (owner, 2026-11-17).
  if (surface === "community" && season.key !== "christmas" && season.key !== "halloween") return null;
  const reduceMotion = reduceMotionCache;
  // Only snow falls (owner, 2026-11-17: no falling hearts, shamrocks, eggs or leaves). Everything else is a calm scene along the bottom.
  const falling = season.particle === "snow";
  const message = overlay ? "Happy New Year" : SPLASH_MESSAGES[season.key];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {falling && !reduceMotion
        ? Array.from({ length: FLAKES }, (_, i) => <Flake key={i} index={i} width={width} height={height} particle={season.particle} />)
        : null}
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
