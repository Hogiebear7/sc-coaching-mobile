import { useEffect, useMemo, useState } from "react";
import { Animated, Easing } from "react-native";

import { SEASON_PREVIEW_ENABLED } from "@/lib/season";

// A New Year fireworks show (1 and 2 January). Each firework does what a real one does:
//  - a rocket climbs from low on the screen with a short tail, slowing as it rises;
//  - it bursts with a soft flash;
//  - the sparks fly out fast, then slow right down (air drag), then sag under gravity as they fade, so the burst opens and droops like a willow;
//  - each spark has a short trail behind it, shrinks as it burns out, and some twinkle on the way down.
// Several go off one after another, different colours, then it is over. It plays once each time the app opens (per screen). Everything is a transform or opacity
// on the native animation thread; only the bursts happening now exist on screen. Reduced motion is handled by the caller.

const PALETTES: [string, string][] = [
  ["#ffd36b", "#fff3c4"],
  ["#ff6b6b", "#ffd36b"],
  ["#6bb7ff", "#e6f3ff"],
  ["#7cf0b0", "#e8fff2"],
  ["#ff8be0", "#ffe3f6"],
  ["#c6a15b", "#ffffff"],
];
const BURSTS = 11;
const GAP_MS = 760;
const ROCKET_MS = 650;
const BURST_MS = 2400;
const STEPS = 10; // points along each spark's path (the path is a smooth curve drawn through them)

const played: Record<string, boolean> = {};

function rand(i: number, n: number): number {
  return ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
}

type BurstSpec = { id: number; x: number; y: number; palette: [string, string]; sparks: number; radius: number; gravity: number };

function Spark({ t, angle, speed, colour, size, twinkle, trail, gravity }: { t: Animated.Value; angle: number; speed: number; colour: string; size: number; twinkle: boolean; trail: boolean; gravity: number }) {
  const { xs, ys, txs, tys, ts } = useMemo(() => {
    const ts: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const txs: number[] = [];
    const tys: number[] = [];
    // Distance out: fast at first then slowing (1 - (1 - t)^3). Gravity pulls down more and more as it goes (t^2). The trail is the same path a moment earlier.
    const at = (u: number) => {
      const k = Math.max(0, u);
      const out = 1 - Math.pow(1 - k, 3);
      return { x: Math.cos(angle) * speed * out, y: Math.sin(angle) * speed * out + gravity * k * k };
    };
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      ts.push(u);
      const p = at(u);
      const q = at(u - 0.09);
      xs.push(p.x);
      ys.push(p.y);
      txs.push(q.x);
      tys.push(q.y);
    }
    return { xs, ys, txs, tys, ts };
  }, [angle, speed, gravity]);

  const opacity = twinkle
    ? t.interpolate({ inputRange: [0, 0.04, 0.35, 0.48, 0.58, 0.68, 0.8, 1], outputRange: [0, 1, 0.9, 0.3, 0.95, 0.25, 0.6, 0] })
    : t.interpolate({ inputRange: [0, 0.04, 0.55, 1], outputRange: [0, 1, 0.8, 0] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  return (
    <>
      {trail ? (
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size * 0.75,
            height: size * 0.75,
            borderRadius: size,
            backgroundColor: colour,
            opacity: t.interpolate({ inputRange: [0, 0.06, 0.5, 1], outputRange: [0, 0.45, 0.25, 0] }),
            transform: [{ translateX: t.interpolate({ inputRange: ts, outputRange: txs }) }, { translateY: t.interpolate({ inputRange: ts, outputRange: tys }) }, { scale }],
          }}
        />
      ) : null}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colour,
          opacity,
          transform: [{ translateX: t.interpolate({ inputRange: ts, outputRange: xs }) }, { translateY: t.interpolate({ inputRange: ts, outputRange: ys }) }, { scale }],
        }}
      />
    </>
  );
}

function Burst({ spec, height }: { spec: BurstSpec; height: number }) {
  const [rocket] = useState(() => new Animated.Value(0));
  const [t] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const run = Animated.sequence([
      Animated.timing(rocket, { toValue: 1, duration: ROCKET_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(flash, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 1, duration: BURST_MS, easing: Easing.linear, useNativeDriver: true }),
      ]),
    ]);
    run.start();
    return () => run.stop();
  }, [rocket, t, flash]);

  const sparks = useMemo(
    () =>
      Array.from({ length: spec.sparks }, (_, i) => {
        const r = (n: number) => rand(spec.id * 100 + i, n);
        // Evenly round, with a little wobble in the angle and a spread of speeds so it fills in like a real burst rather than a perfect circle.
        return {
          angle: (i / spec.sparks) * Math.PI * 2 + (r(1) - 0.5) * 0.18,
          speed: spec.radius * (0.55 + r(2) * 0.5),
          colour: r(3) > 0.35 ? spec.palette[0] : spec.palette[1],
          size: 2.6 + r(4) * 2.2,
          twinkle: r(5) > 0.6,
          trail: r(6) > 0.3,
        };
      }),
    [spec]
  );

  return (
    <>
      {/* The rocket: a bright head with a short tail, climbing and slowing, gone when it bursts. */}
      <Animated.View
        style={{
          position: "absolute",
          left: spec.x - 1.5,
          top: 0,
          width: 3,
          height: 26,
          borderRadius: 2,
          backgroundColor: "#fff3c4",
          opacity: rocket.interpolate({ inputRange: [0, 0.1, 0.92, 1], outputRange: [0, 0.8, 0.8, 0] }),
          transform: [{ translateY: rocket.interpolate({ inputRange: [0, 1], outputRange: [height, spec.y] }) }],
        }}
      />
      {/* The flash as it bursts. */}
      <Animated.View
        style={{
          position: "absolute",
          left: spec.x - 40,
          top: spec.y - 40,
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: spec.palette[1],
          opacity: flash.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
          transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.5] }) }],
        }}
      />
      <Animated.View style={{ position: "absolute", left: spec.x, top: spec.y, width: 0, height: 0 }}>
        {sparks.map((s, i) => (
          <Spark key={i} t={t} angle={s.angle} speed={s.speed} colour={s.colour} size={s.size} twinkle={s.twinkle} trail={s.trail} gravity={spec.gravity} />
        ))}
      </Animated.View>
    </>
  );
}

export function FireworksShow({ width, height, surface }: { width: number; height: number; surface: string }) {
  // Each screen plays the show once per app launch.
  const [active] = useState(() => {
    // Test builds replay it every time it is picked in Settings, so it can be watched again without restarting the app.
    if (played[surface] && !SEASON_PREVIEW_ENABLED) return false;
    played[surface] = true;
    return true;
  });
  const [live, setLive] = useState<BurstSpec[]>([]);

  const specs = useMemo<BurstSpec[]>(
    () =>
      Array.from({ length: BURSTS }, (_, i) => ({
        id: i + 1,
        x: width * (0.14 + rand(i, 1) * 0.72),
        y: height * (0.1 + rand(i, 2) * 0.3),
        palette: PALETTES[i % PALETTES.length],
        sparks: 30 + Math.floor(rand(i, 3) * 3) * 4,
        radius: Math.min(width, height) * (0.2 + rand(i, 4) * 0.08),
        gravity: 38 + rand(i, 5) * 34,
      })),
    [width, height]
  );

  useEffect(() => {
    if (!active) return undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    specs.forEach((spec, i) => {
      const start = 500 + i * GAP_MS + rand(i, 6) * 260;
      timers.push(setTimeout(() => setLive((cur) => [...cur, spec]), start));
      // Gone once it has finished, so only the fireworks happening now exist.
      timers.push(setTimeout(() => setLive((cur) => cur.filter((b) => b.id !== spec.id)), start + ROCKET_MS + BURST_MS + 200));
    });
    return () => timers.forEach(clearTimeout);
  }, [active, specs]);

  if (!active) return null;
  return (
    <>
      {live.map((spec) => (
        <Burst key={spec.id} spec={spec} height={height} />
      ))}
    </>
  );
}
