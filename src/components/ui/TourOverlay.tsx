import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/app/primitives";
import { appTitle } from "@/constants/theme";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { useProfile } from "@/lib/queries/profile";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { TOUR_PROMPT, type TourPage } from "@/lib/tour-content";
import { useTour } from "@/lib/tour-context";
import { hasTourTarget, measureTourTarget, scrollTourTargetIntoView, type TourRect } from "@/lib/tour-registry";
import { nextVisibleStep } from "@/lib/tour-state";

// The tour's UI, mounted once near the app root (app/_layout.tsx). It reads
// everything from useTour(), so screens do not know the tour exists beyond
// marking what can be spotlighted with tourTarget() (lib/tour-registry.ts).
//
// It is a full-screen overlay (not a Modal): dim layers around the target
// leave a hole that glides between steps, a gold ring marks the target, and a
// card with a small guide talks the member through it. All spotlight motion
// uses the JS driver (it animates layout); the card and guide use the native
// driver (opacity/transform only). Reduce Motion turns the motion and the
// typing effect off.

const DIM = "rgba(4,10,20,0.8)";
const HOLE_PAD = 8;
const HOLE_RADIUS = 18;
const CARD_ROOM = 250;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReduce(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Small pieces ────────────────────────────────────────────────────────────

/** Text that writes itself out. Tap to finish. The unwritten part is laid out but transparent, so the card never changes height mid-sentence. */
function TypedText({ text, instant, style }: { text: string; instant: boolean; style: object }) {
  // Callers give each new text its own `key`, so this starts from 0 per text.
  const [typed, setTyped] = useState(0);
  const shown = instant ? text.length : Math.min(typed, text.length);
  useEffect(() => {
    if (instant) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const count = Math.min(text.length, Math.floor((Date.now() - startedAt) / 14));
      setTyped(count);
      if (count >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [text, instant]);
  return (
    <Pressable onPress={() => setTyped(text.length)} accessible accessibilityLabel={text} importantForAccessibility="yes">
      <Text style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {text.slice(0, shown)}
        <Text style={{ color: "transparent" }}>{text.slice(shown)}</Text>
      </Text>
    </Pressable>
  );
}

/** The guide: a gold-ringed S&C badge that breathes. Purely decorative. */
function Guide({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  const styles = useStyles();
  const [breathe] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduceMotion]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[styles.guideHalo, { width: size, height: size, borderRadius: size / 2, opacity: haloOpacity, transform: [{ scale }] }]}
      />
      <View style={[styles.guideBadge, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.guideText, { fontSize: size * 0.46, lineHeight: size * 0.52 }]}>S&amp;C</Text>
      </View>
    </View>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  const styles = useStyles();
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotActive, i < active && styles.dotDone]} />
      ))}
    </View>
  );
}

/** Fades the whole overlay in on mount and lets the parent fade it out before it hands control back. */
function useOverlayFade(reduceMotion: boolean) {
  const [opacity] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 0 : 260, useNativeDriver: true }).start();
  }, [opacity, reduceMotion]);
  const fadeOut = useCallback(
    (then: () => void) => {
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start(() => then());
    },
    [opacity, reduceMotion]
  );
  return { opacity, fadeOut };
}

// ─── First-run prompt ────────────────────────────────────────────────────────

function TourPrompt({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const { opacity, fadeOut } = useOverlayFade(reduceMotion);
  const { data: profile } = useProfile();
  const first = profile?.fullName?.trim().split(/\s+/)[0];
  const [rise] = useState(() => new Animated.Value(reduceMotion ? 0 : 18));
  useEffect(() => {
    Animated.timing(rise, { toValue: 0, duration: reduceMotion ? 0 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [rise, reduceMotion]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.promptRoot, { opacity }]} accessibilityViewIsModal>
      <Animated.View style={[styles.promptCard, { transform: [{ translateY: rise }] }]}>
        <Guide size={64} reduceMotion={reduceMotion} />
        <Text style={styles.promptTitle}>{first ? `Hey ${first}.` : "Hey there."}</Text>
        <Text style={styles.promptSub}>{TOUR_PROMPT.title}</Text>
        <TypedText text={TOUR_PROMPT.body} instant={reduceMotion} style={styles.promptBody} />
        <PillButton
          title={TOUR_PROMPT.start}
          onPress={() => fadeOut(onStart)}
          style={{ alignSelf: "stretch", marginTop: 24 }}
        />
        <Pressable
          onPress={() => {
            tapFeedback();
            fadeOut(onLater);
          }}
          hitSlop={10}
          style={styles.later}
          accessibilityRole="button"
        >
          <Text style={styles.laterText}>{TOUR_PROMPT.later}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── A page's spotlight tour ─────────────────────────────────────────────────

function PageTour({ page, onFinish, onSkip }: { page: TourPage; onFinish: () => void; onSkip: () => void }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { opacity, fadeOut } = useOverlayFade(reduceMotion);

  const rootRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Where the spotlight is. Starts as nothing, in the middle, so the first
  // step opens out of the dark.
  const [hx] = useState(() => new Animated.Value(0));
  const [hy] = useState(() => new Animated.Value(0));
  const [hw] = useState(() => new Animated.Value(0));
  const [hh] = useState(() => new Animated.Value(0));
  const [ringOpacity] = useState(() => new Animated.Value(0));
  const [cardOpacity] = useState(() => new Animated.Value(0));
  const [cardShift] = useState(() => new Animated.Value(12));

  const [display, setDisplay] = useState<{ index: number; hole: Hole | null } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [request, setRequest] = useState({ index: 0, dir: 1 as 1 | -1, n: 0 });
  const shownCount = useRef(0);
  const steps = page.steps;

  const isPresent = useCallback((i: number) => {
    const target = steps[i]?.target;
    return !target || hasTourTarget(target);
  }, [steps]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    rootRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
      setSize({ w: width, h: height });
    });
  }, []);

  useEffect(() => {
    if (size.w === 0) return;
    let cancelled = false;

    const animateHole = (hole: Hole | null) => {
      const to = hole ?? { x: size.w / 2, y: size.h * 0.4, w: 0, h: 0 };
      const spring = (v: Animated.Value, value: number) =>
        reduceMotion
          ? Animated.timing(v, { toValue: value, duration: 0, useNativeDriver: false })
          : Animated.spring(v, { toValue: value, friction: 9, tension: 55, useNativeDriver: false });
      Animated.parallel([
        spring(hx, to.x),
        spring(hy, to.y),
        spring(hw, to.w),
        spring(hh, to.h),
        Animated.timing(ringOpacity, { toValue: hole ? 1 : 0, duration: reduceMotion ? 0 : 260, useNativeDriver: false }),
      ]).start();
    };

    const present = async (index: number, rect: TourRect | null) => {
      shownCount.current += 1;
      await new Promise<void>((resolve) =>
        Animated.timing(cardOpacity, { toValue: 0, duration: reduceMotion ? 0 : 100, useNativeDriver: true }).start(() => resolve())
      );
      if (cancelled) return;
      const hole: Hole | null = rect
        ? (() => {
            const left = Math.max(4, rect.x - origin.current.x - HOLE_PAD);
            const top = Math.max(4, rect.y - origin.current.y - HOLE_PAD);
            const right = Math.min(size.w - 4, rect.x - origin.current.x + rect.width + HOLE_PAD);
            const bottom = Math.min(size.h - 4, rect.y - origin.current.y + rect.height + HOLE_PAD);
            return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
          })()
        : null;
      setDisplay({ index, hole });
      animateHole(hole);
      cardShift.setValue(reduceMotion ? 0 : 12);
      selectionFeedback();
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: reduceMotion ? 0 : 280, delay: reduceMotion ? 0 : 120, useNativeDriver: true }),
        Animated.timing(cardShift, { toValue: 0, duration: reduceMotion ? 0 : 280, delay: reduceMotion ? 0 : 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    };

    const run = async () => {
      let i = request.index;
      for (;;) {
        const step = steps[i];
        if (!step) {
          // Walked off the end. If nothing was ever shown (the screen never
          // produced its targets), leave the tour unseen so it can try again.
          if (shownCount.current > 0) fadeOut(onFinish);
          else setHidden(true);
          return;
        }
        if (!step.target) {
          await present(i, null);
          return;
        }
        // The first step may be waiting on the screen's data; later ones should already be there.
        const maxWait = shownCount.current === 0 ? 3000 : 500;
        let waited = 0;
        while (!hasTourTarget(step.target) && waited < maxWait) {
          await sleep(200);
          waited += 200;
          if (cancelled) return;
        }
        if (cancelled) return;
        if (hasTourTarget(step.target)) {
          const scrolled = await scrollTourTargetIntoView(page.key, step.target);
          if (cancelled) return;
          if (scrolled) await sleep(reduceMotion ? 60 : 480);
          if (cancelled) return;
          const rect = await measureTourTarget(step.target);
          if (cancelled) return;
          const visible = rect && rect.y + rect.height / 2 > origin.current.y && rect.y + rect.height / 2 < origin.current.y + size.h;
          if (rect && visible) {
            await present(i, rect);
            return;
          }
        }
        i += request.dir;
        if (i < 0) return; // nothing earlier can be shown: stay where we are
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, size.w, size.h]);

  const current = display ? steps[display.index] : null;
  const visibleSteps = steps.filter((s) => !s.target || hasTourTarget(s.target));
  const position = current ? Math.max(0, visibleSteps.findIndex((s) => s.id === current.id)) : 0;
  const nextIndex = display ? nextVisibleStep(steps.length, display.index, 1, isPresent) : -1;
  const prevIndex = display ? nextVisibleStep(steps.length, display.index, -1, isPresent) : -1;

  const goNext = useCallback(() => {
    tapFeedback();
    if (nextIndex === -1) fadeOut(onFinish);
    else setRequest((r) => ({ index: nextIndex, dir: 1, n: r.n + 1 }));
  }, [nextIndex, fadeOut, onFinish]);
  const goBack = useCallback(() => {
    if (prevIndex === -1) return;
    tapFeedback();
    setRequest((r) => ({ index: prevIndex, dir: -1, n: r.n + 1 }));
  }, [prevIndex]);

  // The Android back button steps back through the tour rather than leaving the screen under it.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

  if (hidden) return null;

  const hole = display?.hole ?? null;
  // Card goes below the target if there is room, else above, else pinned to the bottom.
  const spaceBelow = hole ? size.h - (hole.y + hole.h) - insets.bottom : 0;
  const spaceAbove = hole ? hole.y - insets.top : 0;
  const cardPosition: object = !hole
    ? { top: 0, bottom: 0, justifyContent: "center" }
    : spaceBelow >= CARD_ROOM
      ? { top: hole.y + hole.h + 14 }
      : spaceAbove >= CARD_ROOM
        ? { bottom: size.h - hole.y + 14 }
        : { bottom: insets.bottom + 12 };

  return (
    <Animated.View ref={rootRef} onLayout={onLayout} style={[StyleSheet.absoluteFill, { opacity }]} accessibilityViewIsModal>
      {/* Four dim layers leave a hole at the target. They also swallow touches, so the screen underneath cannot be used mid-tour. */}
      <Animated.View style={[styles.dim, { top: 0, left: 0, right: 0, height: hy }]} />
      <Animated.View style={[styles.dim, { top: Animated.add(hy, hh), left: 0, right: 0, bottom: 0 }]} />
      <Animated.View style={[styles.dim, { top: hy, height: hh, left: 0, width: hx }]} />
      <Animated.View style={[styles.dim, { top: hy, height: hh, left: Animated.add(hx, hw), right: 0 }]} />
      {/* Soft halo, then the ring. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            opacity: ringOpacity,
            left: Animated.subtract(hx, 5),
            top: Animated.subtract(hy, 5),
            width: Animated.add(hw, 10),
            height: Animated.add(hh, 10),
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: colors.brand, opacity: ringOpacity, left: hx, top: hy, width: hw, height: hh }]}
      />

      {/* Touches in the hole land on this, not on the screen below. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />

      {current ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.cardWrap, cardPosition, { opacity: cardOpacity, transform: [{ translateY: cardShift }] }]}
        >
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Guide size={34} reduceMotion={reduceMotion} />
              <Text style={styles.pageLabel}>{page.title}</Text>
              <View style={{ flex: 1 }} />
              <Dots count={visibleSteps.length} active={position} />
            </View>
            <Text style={styles.stepTitle} accessibilityRole="header">
              {current.title}
            </Text>
            <TypedText key={`${page.key}-${current.id}`} text={current.body} instant={reduceMotion} style={styles.stepBody} />
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  tapFeedback();
                  fadeOut(onSkip);
                }}
                hitSlop={10}
                style={styles.skip}
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>Skip tour</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              {prevIndex !== -1 ? (
                <Pressable onPress={goBack} hitSlop={10} style={styles.back} accessibilityRole="button">
                  <Text style={styles.backText}>Back</Text>
                </Pressable>
              ) : null}
              <PillButton title={nextIndex === -1 ? "Done" : "Next"} onPress={goNext} style={styles.next} />
            </View>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

// ─── Host ────────────────────────────────────────────────────────────────────

export function TourHost() {
  const { showPrompt, activePage, startTour, deferTour, dismissPage, skipTour } = useTour();
  if (showPrompt) return <TourPrompt onStart={startTour} onLater={deferTour} />;
  if (activePage) return <PageTour key={activePage.key} page={activePage} onFinish={dismissPage} onSkip={skipTour} />;
  return null;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    dim: { position: "absolute", backgroundColor: DIM },
    halo: { position: "absolute", borderRadius: HOLE_RADIUS + 5, borderWidth: 5, borderColor: "rgba(198,161,91,0.22)" },
    ring: { position: "absolute", borderRadius: HOLE_RADIUS, borderWidth: 2 },

    cardWrap: { position: "absolute", left: 0, right: 0, paddingHorizontal: 16 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    pageLabel: { fontSize: 13, fontWeight: "600", color: c.textMuted, letterSpacing: 0.4 },
    stepTitle: { ...appTitle(30, c.text) },
    stepBody: { marginTop: 6, fontSize: 16, lineHeight: 23, color: c.textSecondary },
    actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 20 },
    skip: { paddingVertical: 8 },
    skipText: { fontSize: 14, color: c.textMuted, fontWeight: "500" },
    back: { paddingVertical: 8, paddingHorizontal: 6 },
    backText: { fontSize: 15, color: c.textSecondary, fontWeight: "600" },
    next: { minWidth: 104 },

    dots: { flexDirection: "row", gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.hairline },
    dotDone: { backgroundColor: c.textMuted },
    dotActive: { width: 18, backgroundColor: c.brand },

    guideHalo: { position: "absolute", borderWidth: 2, borderColor: c.brand },
    guideBadge: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.brand, backgroundColor: "rgba(198,161,91,0.14)" },
    guideText: { fontFamily: "Teko", fontWeight: "600", color: c.brand, letterSpacing: 0.5 },

    promptRoot: { backgroundColor: DIM, alignItems: "center", justifyContent: "center", padding: 24 },
    promptCard: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: c.surface,
      borderRadius: 28,
      padding: 28,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      elevation: 12,
    },
    promptTitle: { ...appTitle(40, c.text), marginTop: 18, textAlign: "center" },
    promptSub: { fontSize: 17, fontWeight: "600", color: c.brand, marginTop: 2, textAlign: "center" },
    promptBody: { marginTop: 12, fontSize: 16, lineHeight: 23, color: c.textSecondary, textAlign: "center" },
    later: { marginTop: 14, padding: 6 },
    laterText: { fontSize: 15, fontWeight: "600", color: c.textMuted },
  })
);
