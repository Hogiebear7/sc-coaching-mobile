import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useFrameCallback, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { gravityOnScreen, liquidSurface, surfacePath, targetTilt } from "@/lib/liquid";
import { makeStyles, useAppTheme } from "@/lib/theme";

// The hydration bottle. It starts empty and fills towards the day's goal as
// drinks are logged. The liquid responds to the phone: tilt it and the surface
// stays level, shake it and it slops about, and it settles back the way real
// water does. Without motion sensors (or with Reduce Motion on) it is a still
// bottle that just changes level.

const BODY_W = 84;
const BODY_H = 150;

/** Height of the part of the bottle the water fills, for anything that has to line up with it (the drag control). */
export const LIQUID_BOTTLE_BODY_H = BODY_H;

// A spring for the surface angle. Slightly under-damped so it overshoots and
// wobbles a touch before settling, which is what makes it read as liquid.
const STIFFNESS = 80;
const DAMPING = 5.2;

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Accelerometer = {
  setUpdateInterval: (ms: number) => void;
  addListener: (cb: (m: { x: number; y: number; z: number }) => void) => { remove: () => void };
};

// The sensors are a native module. A build that predates it (or a platform
// without it) must still show the bottle, so load it defensively.
function loadAccelerometer(): Accelerometer | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("expo-sensors") as { Accelerometer: Accelerometer }).Accelerometer ?? null;
  } catch {
    return null;
  }
}

export function LiquidBottle({ fillPct, reduceMotion }: { fillPct: number; reduceMotion: boolean }) {
  const styles = useStyles();
  const { data: dc } = useAppTheme();

  const level = useSharedValue(fillPct);
  const angle = useSharedValue(0);
  const velocity = useSharedValue(0);
  const energy = useSharedValue(0);
  const phase = useSharedValue(0);
  const gx = useSharedValue(0);
  const gy = useSharedValue(-1);
  const impulse = useSharedValue(0);
  const calm = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    calm.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, calm]);

  useEffect(() => {
    level.value = reduceMotion ? fillPct : withTiming(fillPct, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [fillPct, reduceMotion, level]);

  // The physics, one step per frame.
  const frame = useFrameCallback((info) => {
    "worklet";
    if (calm.value === 1) return;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.7) / 1000, 0.04);
    const target = targetTilt(gx.value, gy.value);
    velocity.value += impulse.value;
    impulse.value = 0;
    velocity.value += (STIFFNESS * (target - angle.value) - DAMPING * velocity.value) * dt;
    angle.value += velocity.value * dt;
    energy.value += (Math.min(1, Math.abs(velocity.value)) - energy.value) * Math.min(1, dt * 3);
    phase.value += dt * (2.2 + energy.value * 5);
  }, false);

  // Only run while the Nutrition tab is on screen: no point animating, or
  // listening to the sensors, for a bottle nobody can see.
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return undefined;
      frame.setActive(true);
      let subscription: { remove: () => void } | null = null;
      const accelerometer = loadAccelerometer();
      if (accelerometer) {
        try {
          accelerometer.setUpdateInterval(33);
          let lastX = 0;
          subscription = accelerometer.addListener(({ x, y }) => {
            const g = gravityOnScreen(x, y, Platform.OS);
            gx.value = g.gx;
            gy.value = g.gy;
            // A sudden sideways shove also kicks the liquid, beyond what the tilt alone does.
            const shove = Math.max(-1.5, Math.min(1.5, g.gx - lastX));
            lastX = g.gx;
            impulse.value += shove * 3.5;
          });
        } catch {
          subscription = null;
        }
      }
      return () => {
        frame.setActive(false);
        subscription?.remove();
        gx.value = 0;
        gy.value = -1;
      };
    }, [reduceMotion, frame, gx, gy, impulse])
  );

  const frontProps = useAnimatedProps(() => {
    const amp = calm.value === 1 ? 0 : 1.4 + energy.value * 3.6;
    const ys = liquidSurface({
      width: BODY_W,
      height: BODY_H,
      fillPct: level.value,
      slope: Math.tan(angle.value),
      amp,
      phase: phase.value,
    });
    return { d: surfacePath(BODY_W, BODY_H, ys) };
  });
  // A second, paler wave behind the first gives the surface some depth.
  const backProps = useAnimatedProps(() => {
    const amp = calm.value === 1 ? 0 : 1.9 + energy.value * 4.2;
    const ys = liquidSurface({
      width: BODY_W,
      height: BODY_H,
      fillPct: level.value,
      slope: Math.tan(angle.value),
      amp,
      phase: phase.value + 2.1,
    });
    return { d: surfacePath(BODY_W, BODY_H, ys) };
  });

  const initial = surfacePath(
    BODY_W,
    BODY_H,
    liquidSurface({ width: BODY_W, height: BODY_H, fillPct, slope: 0, amp: 0, phase: 0 })
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.cap} />
      <View style={styles.neck} />
      <View style={styles.body}>
        <Svg width={BODY_W} height={BODY_H} style={styles.svg}>
          <AnimatedPath d={initial} animatedProps={backProps} fill={dc.hydration} fillOpacity={0.4} />
          <AnimatedPath d={initial} animatedProps={frontProps} fill={dc.hydration} />
        </Svg>
        {/* Glass-sheen highlight, purely decorative, always above the liquid. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sheen}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { width: BODY_W, alignItems: "center" },
    cap: { width: 30, height: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: c.textMuted },
    neck: { width: 36, height: 14, backgroundColor: c.control },
    body: { width: BODY_W, height: BODY_H, borderRadius: 20, backgroundColor: c.control, overflow: "hidden" },
    svg: { position: "absolute", top: 0, left: 0 },
    sheen: { position: "absolute", top: 0, left: 0, bottom: 0, width: "45%" },
  })
);
