import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/app/primitives";
import { BrandMark } from "@/components/ui/BrandMark";
import { appTitle } from "@/constants/theme";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { useProfile } from "@/lib/queries/profile";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { TOUR_PROMPT, type TourPage } from "@/lib/tour-content";
import { useTour } from "@/lib/tour-context";
import { hasTourTarget, measureTourTarget, scrollTourTargetIntoView, type TourRect } from "@/lib/tour-registry";
import { nextVisibleStep, placeCard } from "@/lib/tour-state";

// The tour's UI, mounted once near the app root (app/_layout.tsx). It reads
// everything from useTour(), so screens do not know the tour exists beyond
// marking what can be spotlighted with tourTarget() (lib/tour-registry.ts).
//
// It is a full-screen overlay (not a Modal): dim layers around the target
// leave a hole, a gold ring marks the target, and a card with the club's logo
// talks the member through it. Moving between steps is one motion: the hole
// and the card glide to their new places together while only the words
// cross-fade. The hole uses the JS driver (it animates layout); everything
// else uses the native driver. Reduce Motion turns the motion and the typing
// effect off.

const DIM = "rgba(4,10,20,0.8)";
const HOLE_PAD = 8;
const HOLE_RADIUS = 18;
const MOVE_MS = 420;
const MOVE_EASING = Easing.inOut(Easing.cubic);

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

/** The club's logo, breathing very gently so the guide feels present. */
function Guide({ height, reduceMotion }: { height: number; reduceMotion: boolean }) {
  const [breathe] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduceMotion]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <BrandMark height={height} />
    </Animated.View>
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
        <Guide height={52} reduceMotion={reduceMotion} />
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

  // The spotlight. Starts as nothing, in the middle, so the first step opens
  // out of the dark.
  const [hx] = useState(() => new Animated.Value(0));
  const [hy] = useState(() => new Animated.Value(0));
  const [hw] = useState(() => new Animated.Value(0));
  const [hh] = useState(() => new Animated.Value(0));
  const [ringOpacity] = useState(() => new Animated.Value(0));
  // The card: one persistent view that glides (cardY), appears once
  // (cardOpacity/cardRise), and whose words cross-fade (contentOpacity).
  const [cardY] = useState(() => new Animated.Value(0));
  const [cardOpacity] = useState(() => new Animated.Value(0));
  const [cardRise] = useState(() => new Animated.Value(14));
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const [cardH, setCardH] = useState(0);
  const cardPlaced = useRef(false);

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

  // Glide the spotlight to a place (or collapse it to nothing).
  const animateHole = useCallback((hole: Hole | null) => {
    const to = hole ?? { x: size.w / 2, y: size.h * 0.4, w: 0, h: 0 };
    const move = (v: Animated.Value, value: number) =>
      Animated.timing(v, { toValue: value, duration: reduceMotion ? 0 : MOVE_MS, easing: MOVE_EASING, useNativeDriver: false });
    Animated.parallel([
      move(hx, to.x),
      move(hy, to.y),
      move(hw, to.w),
      move(hh, to.h),
      Animated.timing(ringOpacity, { toValue: hole ? 1 : 0, duration: reduceMotion ? 0 : 300, useNativeDriver: false }),
    ]).start();
  }, [size.w, size.h, reduceMotion, hx, hy, hw, hh, ringOpacity]);

  useEffect(() => {
    if (size.w === 0) return;
    let cancelled = false;

    const present = async (index: number, rect: TourRect | null) => {
      shownCount.current += 1;
      const first = shownCount.current === 1;
      const hole: Hole | null = rect
        ? (() => {
            const left = Math.max(4, rect.x - origin.current.x - HOLE_PAD);
            const top = Math.max(4, rect.y - origin.current.y - HOLE_PAD);
            const right = Math.min(size.w - 4, rect.x - origin.current.x + rect.width + HOLE_PAD);
            const bottom = Math.min(size.h - 4, rect.y - origin.current.y + rect.height + HOLE_PAD);
            return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
          })()
        : null;
      if (!first) {
        // The words fade out while the card and spotlight start to move, then new words fade in.
        await new Promise<void>((resolve) =>
          Animated.timing(contentOpacity, { toValue: 0, duration: reduceMotion ? 0 : 110, useNativeDriver: true }).start(() => resolve())
        );
        if (cancelled) return;
      }
      setDisplay({ index, hole });
      animateHole(hole);
      selectionFeedback();
      if (!first) {
        Animated.timing(contentOpacity, { toValue: 1, duration: reduceMotion ? 0 : 260, delay: reduceMotion ? 0 : 120, useNativeDriver: true }).start();
      }
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
          if (scrolled) {
            // The screen is scrolling under us: close the spotlight while it moves, then open it on the new spot.
            animateHole(null);
            await sleep(reduceMotion ? 60 : 520);
          }
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

  // Put the card where the step wants it. The first time it is placed
  // directly and fades in; after that it glides alongside the spotlight.
  useEffect(() => {
    if (!display || size.h === 0 || cardH === 0) return;
    const y = placeCard({ hole: display.hole, cardH, screenH: size.h, insetTop: insets.top, insetBottom: insets.bottom });
    if (!cardPlaced.current) {
      cardPlaced.current = true;
      cardY.setValue(y);
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: reduceMotion ? 0 : 300, delay: reduceMotion ? 0 : 180, useNativeDriver: true }),
        Animated.timing(cardRise, { toValue: 0, duration: reduceMotion ? 0 : 300, delay: reduceMotion ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.timing(cardY, { toValue: y, duration: reduceMotion ? 0 : MOVE_MS, easing: MOVE_EASING, useNativeDriver: true }).start();
  }, [display, cardH, size.h, insets.top, insets.bottom, reduceMotion, cardY, cardOpacity, cardRise]);

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
          onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}
          style={[styles.cardWrap, { opacity: cardOpacity, transform: [{ translateY: Animated.add(cardY, cardRise) }] }]}
        >
          <View style={styles.card}>
            <Animated.View style={{ opacity: contentOpacity }}>
              <View style={styles.cardTop}>
                <Guide height={24} reduceMotion={reduceMotion} />
                <View style={{ flex: 1 }} />
                <Text style={styles.pageLabel}>{page.title}</Text>
                <Dots count={visibleSteps.length} active={position} />
              </View>
              <Text style={styles.stepTitle} accessibilityRole="header">
                {current.title}
              </Text>
              <TypedText key={`${page.key}-${current.id}`} text={current.body} instant={reduceMotion} style={styles.stepBody} />
            </Animated.View>
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

    // The card is lighter than the screens it floats over, with a gold outline and a deep shadow, so it never melts into them.
    cardWrap: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16 },
    card: {
      backgroundColor: c.surfaceHi,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: `${c.brand}73`,
      shadowColor: "#000",
      shadowOpacity: 0.6,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 12 },
      elevation: 18,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
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
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)" },
    dotDone: { backgroundColor: c.textMuted },
    dotActive: { width: 18, backgroundColor: c.brand },

    promptRoot: { backgroundColor: DIM, alignItems: "center", justifyContent: "center", padding: 24 },
    promptCard: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: c.surfaceHi,
      borderRadius: 28,
      padding: 28,
      alignItems: "center",
      borderWidth: 1,
      borderColor: `${c.brand}73`,
      shadowColor: "#000",
      shadowOpacity: 0.6,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 12 },
      elevation: 18,
    },
    promptTitle: { ...appTitle(40, c.text), marginTop: 18, textAlign: "center" },
    promptSub: { fontSize: 17, fontWeight: "600", color: c.brand, marginTop: 2, textAlign: "center" },
    promptBody: { marginTop: 12, fontSize: 16, lineHeight: 23, color: c.textSecondary, textAlign: "center" },
    later: { marginTop: 14, padding: 6 },
    laterText: { fontSize: 15, fontWeight: "600", color: c.textMuted },
  })
);
