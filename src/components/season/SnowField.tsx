import { useEffect, useMemo, useState } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";

// Falling snow that reads as snow rather than dots on a conveyor belt.
//
// - Three depths. Far flakes are small, dim and slow; near flakes are bigger, brighter and faster, and a little soft. Different speeds at different depths is
//   most of what makes snow look three-dimensional.
// - Every flake sways on its own rhythm (a smooth back-and-forth, not tied to how far it has fallen), so no two move together.
// - A slow shared gust pushes the whole field sideways and back, harder on near flakes than far ones.
// - Flakes fade in at the top and out at the bottom instead of popping, and they start part-way down the screen, so snow is already falling when the screen opens.
// - A near flake is occasionally a small six-armed crystal that turns slowly as it falls.
//
// Everything runs on the native animation thread (transform and opacity only), about 30 flakes, never takes a touch. Reduced motion is handled by the caller.

type Layer = {
  /** 0 to 1: how close it is. */
  depth: number;
  count: number;
  /** Size range in px. */
  size: [number, number];
  /** Time to fall the screen height, in ms. */
  fall: [number, number];
  /** Sway amplitude range, px. */
  sway: [number, number];
  opacity: [number, number];
  soft: boolean;
};

const LAYERS: Layer[] = [
  { depth: 0.35, count: 14, size: [2, 3.2], fall: [15000, 20000], sway: [6, 14], opacity: [0.3, 0.5], soft: false },
  { depth: 0.65, count: 10, size: [3.4, 5], fall: [10000, 14000], sway: [12, 24], opacity: [0.5, 0.75], soft: false },
  { depth: 1, count: 6, size: [6, 9], fall: [6500, 9500], sway: [18, 34], opacity: [0.7, 0.95], soft: true },
];

/** Repeatable pseudo-random number from an index, so the layout is the same every time and flakes don't clump. */
function rand(index: number, n: number): number {
  return ((Math.sin(index * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
}
const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * t;

/** Moves a value smoothly back and forth between 0 and 1 for ever (each leg is started by hand when the last ends). Returns a function that stops it. */
function pingPong(value: Animated.Value, legMs: number, startAt: number): () => void {
  let stopped = false;
  const go = (to: 0 | 1) => {
    if (stopped) return;
    Animated.timing(value, { toValue: to, duration: legMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(({ finished }) => {
      if (finished) go(to === 1 ? 0 : 1);
    });
  };
  value.setValue(startAt);
  go(startAt > 0.5 ? 0 : 1);
  return () => {
    stopped = true;
    value.stopAnimation();
  };
}

/** Turns a value from 0 to 1 over and over, for ever. Returns a function that stops it. */
function turnForever(value: Animated.Value, ms: number): () => void {
  let stopped = false;
  const go = () => {
    if (stopped) return;
    value.setValue(0);
    Animated.timing(value, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
      if (finished) go();
    });
  };
  go();
  return () => {
    stopped = true;
    value.stopAnimation();
  };
}

function Crystal({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20">
      {[0, 60, 120].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Line key={a} x1={Math.cos(r) * -9} y1={Math.sin(r) * -9} x2={Math.cos(r) * 9} y2={Math.sin(r) * 9} stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" />;
      })}
    </Svg>
  );
}

/** A flake with a soft edge: a bright core fading to nothing, drawn once as a vector. */
function SoftFlake({ size, id }: { size: number; id: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="0.45" stopColor="#ffffff" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="5" cy="5" r="5" fill={`url(#${id})`} />
    </Svg>
  );
}

function Flake({ index, layer, layerIndex, width, height, wind }: { index: number; layer: Layer; layerIndex: number; width: number; height: number; wind: Animated.Value }) {
  const seed = layerIndex * 100 + index;
  const spec = useMemo(() => {
    const size = lerp(layer.size, rand(seed, 2));
    return {
      x: rand(seed, 1) * width,
      size,
      fallMs: lerp(layer.fall, rand(seed, 3)),
      phase: rand(seed, 4),
      sway: lerp(layer.sway, rand(seed, 5)),
      swayMs: 2600 + rand(seed, 6) * 3200,
      swayStart: rand(seed, 7),
      opacity: lerp(layer.opacity, rand(seed, 8)),
      crystal: layer.depth >= 0.65 && rand(seed, 9) > 0.72,
      spinMs: 5000 + rand(seed, 10) * 5000,
      gust: 22 * layer.depth,
    };
  }, [seed, layer, width]);

  const [fall] = useState(() => new Animated.Value(0));
  const [sway] = useState(() => new Animated.Value(spec.swayStart));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Falls from where its phase says (so the screen is never empty at the start), then starts a fresh full fall every time one ends, for as long as the
    // screen is open. Each pass is restarted by hand when it finishes, rather than with a loop, so it can never stall after the first fall.
    let stopped = false;
    const fallFrom = (from: number) => {
      if (stopped) return;
      fall.setValue(from);
      Animated.timing(fall, { toValue: 1, duration: spec.fallMs * (1 - from), easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
        if (finished) fallFrom(0);
      });
    };
    fallFrom(spec.phase);
    // Sways with a smooth ease at each end, like a pendulum.
    const stopSway = pingPong(sway, spec.swayMs, spec.swayStart);
    const stopSpin = spec.crystal ? turnForever(spin, spec.spinMs) : null;
    return () => {
      stopped = true;
      fall.stopAnimation();
      stopSway();
      stopSpin?.();
    };
  }, [fall, sway, spin, spec]);

  const half = spec.size * (spec.crystal ? 3.2 : 1) * (layer.soft && !spec.crystal ? 1.8 : 1);
  const box = half;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: spec.x,
        top: 0,
        width: box,
        height: box,
        opacity: fall.interpolate({ inputRange: [0, 0.07, 0.92, 1], outputRange: [0, spec.opacity, spec.opacity, 0] }),
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-box, height + box] }) },
          { translateX: sway.interpolate({ inputRange: [0, 1], outputRange: [-spec.sway, spec.sway] }) },
          { translateX: wind.interpolate({ inputRange: [0, 1], outputRange: [-spec.gust, spec.gust] }) },
          ...(spec.crystal ? [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] : []),
        ],
      }}
    >
      {spec.crystal ? (
        <Crystal size={box} />
      ) : layer.soft ? (
        <SoftFlake size={box} id={`sf${seed}`} />
      ) : (
        <Animated.View style={{ width: box, height: box, borderRadius: box / 2, backgroundColor: "#ffffff" }} />
      )}
    </Animated.View>
  );
}

export function SnowField({ width, height }: { width: number; height: number }) {
  // One slow gust shared by every flake: the whole field leans one way, then the other, over about 11 seconds.
  const [wind] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    return pingPong(wind, 5500, 0.5);
  }, [wind]);

  return (
    <>
      {LAYERS.flatMap((layer, li) => Array.from({ length: layer.count }, (_, i) => <Flake key={`${li}-${i}`} index={i} layer={layer} layerIndex={li} width={width} height={height} wind={wind} />))}
    </>
  );
}
