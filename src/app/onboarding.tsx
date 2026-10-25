import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PillButton } from "@/components/app/primitives";
import { formatDateDisplay } from "@/components/ui/DateField";
import { AppRadius, AppSpace, appTitle } from "@/constants/theme";
import { impactFeedback, selectionFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { hasAccess } from "@/lib/member-access";
import {
  clampWeight,
  defaultGoalWeight,
  directionFor,
  formatKg,
  goalGapLabel,
  type GoalDirection,
} from "@/lib/onboarding";
import { useLogBodyWeight } from "@/lib/queries/body-weight";
import { useGoalTimeline, useSaveGoal } from "@/lib/queries/goal-timeline";
import { useMyNutritionTarget } from "@/lib/queries/nutrition-diary";
import { useMemberTier, useProfile } from "@/lib/queries/profile";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { useReduceMotionPref } from "@/lib/use-reduce-motion";
import { todayDateString } from "@/lib/workout-formatters";

// "Set up your plan" — the post-signup onboarding (App v2, see
// docs/design-inspiration-macrofactor-2026-10.md §6). One question per
// screen, a fixed primary button, then the plan shown *and explained*.
// It writes through the same goal + body-weight routes as Profile's goal
// timeline, so nothing new on the server. Skippable at every step.
type Step = "intro" | "goal" | "weight" | "days" | "building" | "plan" | "next";
const QUESTION_STEPS: Step[] = ["goal", "weight", "days"];
const BUILD_ITEMS = ["Your starting point", "Your goal", "Your training week", "A realistic timeline", "Your calorie target"];

export default function OnboardingScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();
  const reduceMotion = useReduceMotionPref();
  const tier = useMemberTier();
  const { data: profile } = useProfile();
  const { data: timeline, refetch: refetchTimeline } = useGoalTimeline();
  const { data: target } = useMyNutritionTarget();
  const saveGoal = useSaveGoal();
  const logWeight = useLogBodyWeight();

  const [step, setStep] = useState<Step>("intro");
  const [direction, setDirection] = useState<GoalDirection | null>(null);
  const [currentKgInput, setCurrentKg] = useState<number | null>(null);
  const [goalKg, setGoalKg] = useState<number | null>(null);
  const [daysInput, setDays] = useState<number | null>(null);
  const [buildTicks, setBuildTicks] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [suggestedDate, setSuggestedDate] = useState<string | null>(null);
  const [buildRun, setBuildRun] = useState(0);

  // Prefilled from what the member already has on file until they change it.
  const hadWeight = timeline?.currentWeightKg != null;
  const currentKg = currentKgInput ?? (timeline?.currentWeightKg != null ? clampWeight(timeline.currentWeightKg) : null);
  const days = daysInput ?? timeline?.trainingDaysPerWeek ?? null;

  function go(next: Step) {
    tapFeedback();
    setStep(next);
  }

  function chooseDirection(d: GoalDirection) {
    selectionFeedback();
    setDirection(d);
    const base = currentKg ?? 75;
    setGoalKg(defaultGoalWeight(d, base));
  }

  function back() {
    tapFeedback();
    const order: Step[] = ["intro", "goal", "weight", "days"];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
    else router.back();
  }

  // Save, then ask the server for the projection and adopt its suggested
  // date — the same sequence as Profile's "Generate timeline".
  useEffect(() => {
    if (step !== "building") return;
    let cancelled = false;
    const tickMs = reduceMotion ? 0 : 380;
    const timer = setInterval(() => setBuildTicks((t) => Math.min(BUILD_ITEMS.length, t + 1)), Math.max(tickMs, 1));
    const minWait = new Promise((r) => setTimeout(r, reduceMotion ? 0 : tickMs * BUILD_ITEMS.length + 250));
    (async () => {
      try {
        if (!hadWeight && currentKg !== null) await logWeight.mutateAsync({ date: todayDateString(), weightKg: currentKg });
        await saveGoal.mutateAsync({ goalWeightKg: goalKg, trainingDaysPerWeek: days });
        const projection = await refetchTimeline();
        const suggested = projection.data?.weightTimeline?.suggestedDate ?? null;
        if (suggested) await saveGoal.mutateAsync({ goalTargetDate: suggested });
        await minWait;
        if (cancelled) return;
        setSuggestedDate(suggested);
        setBuildTicks(BUILD_ITEMS.length);
        successFeedback();
        setStep("plan");
      } catch {
        if (!cancelled) setBuildError("We couldn't save your plan. Check your connection and try again.");
      } finally {
        clearInterval(timer);
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // Runs on entering the building step, and again on retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, buildRun]);

  function retryBuild() {
    setBuildError(null);
    setBuildTicks(0);
    setBuildRun((n) => n + 1);
  }

  // Leave with one navigation only (never close-then-push).
  function finish(href?: string) {
    impactFeedback();
    if (href) router.replace(href as never);
    else router.back();
  }

  const qIndex = QUESTION_STEPS.indexOf(step);
  const firstName = profile?.fullName?.split(" ")[0] ?? "";
  const weightTimeline = timeline?.weightTimeline ?? null;
  const pace = weightTimeline?.clampedWeeklyRate ?? null;
  const canGymProfile = hasAccess(tier, "gymProfiles");
  const canGenerate = hasAccess(tier, "workoutGenerate");

  let body: ReactNode = null;
  let primary: { label: string; onPress: () => void; disabled?: boolean } | null = null;

  if (step === "intro") {
    body = (
      <>
        <Text style={[appTitle(40, colors.text), styles.center]}>Let&apos;s get started</Text>
        <Text style={[styles.lead, styles.center]}>{firstName ? `${firstName}, your` : "Your"} plan takes about a minute.</Text>
        <View style={styles.stepper}>
          {[
            { t: "Your goal", s: "Where you want to get to." },
            { t: "Your week", s: "How often you can train." },
            { t: "Your plan", s: "A realistic timeline and calorie target, explained." },
          ].map((it, i) => (
            <View key={it.t} style={styles.stepperRow}>
              <View style={styles.stepperRail}>
                <View style={[styles.stepperDot, i === 0 && styles.stepperDotActive]}>
                  <Text style={[styles.stepperNum, i === 0 && { color: colors.onPrimary }]}>{i + 1}</Text>
                </View>
                {i < 2 ? <View style={styles.stepperLine} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 22 }}>
                <Text style={styles.stepperTitle}>{it.t}</Text>
                <Text style={styles.stepperSub}>{it.s}</Text>
              </View>
            </View>
          ))}
        </View>
      </>
    );
    primary = { label: "Start", onPress: () => go("goal") };
  } else if (step === "goal") {
    body = (
      <>
        <Text style={styles.question}>What&apos;s your goal?</Text>
        {(
          [
            { v: "lose", icon: "trending-down", label: "Lose weight", sub: "Lean down while keeping your strength" },
            { v: "maintain", icon: "remove", label: "Maintain", sub: "Stay where you are and perform better" },
            { v: "gain", icon: "trending-up", label: "Gain weight", sub: "Build muscle and size" },
          ] as const
        ).map((o) => (
          <OptionCard key={o.v} icon={o.icon} label={o.label} sub={o.sub} selected={direction === o.v} onPress={() => chooseDirection(o.v)} />
        ))}
      </>
    );
    primary = { label: "Next", onPress: () => go("weight"), disabled: direction === null };
  } else if (step === "weight") {
    const cur = currentKg ?? 75;
    const goal = goalKg ?? cur;
    body = (
      <>
        <Text style={styles.question}>Where are you now, and where are you heading?</Text>
        {!hadWeight ? (
          <WeightDial
            label="Current weight"
            value={cur}
            onChange={(v) => {
              setCurrentKg(v);
              if (direction) setGoalKg(defaultGoalWeight(direction, v));
            }}
          />
        ) : (
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.infoText}>Starting from your logged weight, {formatKg(cur)} kg.</Text>
          </View>
        )}
        <WeightDial
          label="Goal weight"
          value={goal}
          onChange={(v) => {
            setGoalKg(v);
            setDirection(directionFor(cur, v));
          }}
        />
        <View style={[styles.gapPill, { backgroundColor: `${dc.weight}2e` }]}>
          <Text style={styles.gapText}>{goalGapLabel(cur, goal)}</Text>
        </View>
      </>
    );
    primary = { label: "Next", onPress: () => go("days") };
  } else if (step === "days") {
    body = (
      <>
        <Text style={styles.question}>How many days a week can you train?</Text>
        <Text style={styles.lead}>Be realistic — a plan you can keep beats a perfect one you can&apos;t.</Text>
        <View style={styles.dayRow} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const sel = days === d;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  if (!sel) selectionFeedback();
                  setDays(d);
                }}
                style={[styles.day, sel && styles.daySel]}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${d} days a week`}
              >
                <Text style={[styles.dayText, sel && { color: colors.onPrimary }]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
        {days !== null ? (
          <Text style={[styles.lead, styles.center, { marginTop: 14 }]}>
            {days <= 2 ? "A great start — we'll pace your goal to match." : days <= 4 ? "A solid, sustainable week." : "A big week — recovery check-ins will matter."}
          </Text>
        ) : null}
      </>
    );
    primary = { label: "Build my plan", onPress: () => go("building"), disabled: days === null };
  } else if (step === "building") {
    body = (
      <>
        <Text style={styles.question}>Building your plan</Text>
        <View style={{ marginTop: 10 }}>
          {BUILD_ITEMS.map((it, i) => {
            const done = i < buildTicks;
            return (
              <View key={it} style={styles.buildRow}>
                <Text style={[styles.buildText, !done && { color: colors.textMuted }]}>{it}</Text>
                {done ? (
                  <View style={styles.buildTick}>
                    <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                  </View>
                ) : i === buildTicks ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <View style={styles.buildPending} />
                )}
              </View>
            );
          })}
        </View>
        {buildError ? <Text style={styles.error}>{buildError}</Text> : null}
      </>
    );
    primary = buildError ? { label: "Try again", onPress: retryBuild } : null;
  } else if (step === "plan") {
    const date = suggestedDate ?? weightTimeline?.suggestedDate ?? null;
    body = (
      <>
        <Text style={styles.question}>Your plan is ready</Text>
        <View style={styles.tiles}>
          <View style={[styles.tile, { backgroundColor: `${dc.readinessHigh}26` }]}>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
              {date ? formatDateDisplay(date) : "—"}
            </Text>
            <Text style={styles.tileLabel}>target date</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
              {target?.calories != null ? `${target.calories.toLocaleString()}` : "—"}
            </Text>
            <Text style={styles.tileLabel}>kcal a day to start</Text>
          </View>
        </View>

        <Text style={styles.subhead}>How your plan was built</Text>
        {[
          { t: "Starting point", v: currentKg !== null ? `${formatKg(currentKg)} kg` : "—", b: "Your current weight is the baseline everything else is measured from." },
          {
            t: "Goal",
            v: goalKg !== null && currentKg !== null ? goalGapLabel(currentKg, goalKg) : "—",
            b: "Where you want to get to. You can change it any time in Profile.",
          },
          {
            t: "Pace",
            v: pace !== null ? `${pace > 0 ? "+" : pace < 0 ? "−" : ""}${Math.abs(pace).toFixed(2)} kg/week` : "Steady",
            b: `Set for ${days ?? "—"} training days a week and capped at a safe rate, so the plan stays something you can keep up.`,
          },
          {
            t: "Timeline",
            v: date ? formatDateDisplay(date) : "—",
            b: "An optimistic estimate if everything goes to plan. Allow a few extra weeks — progress is rarely a straight line.",
          },
          {
            t: "Calories",
            v: target?.calories != null ? `${target.calories.toLocaleString()} kcal` : "—",
            b: "Your daily starting target. It adjusts as your weight and training change.",
          },
        ].map((r, i, arr) => (
          <View key={r.t} style={styles.explainRow}>
            <View style={styles.stepperRail}>
              <View style={styles.explainNum}>
                <Text style={styles.stepperNum}>{i + 1}</Text>
              </View>
              {i < arr.length - 1 ? <View style={styles.stepperLine} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 18 }}>
              <Text style={styles.stepperTitle}>{r.t}</Text>
              <Text style={styles.explainValue}>{r.v}</Text>
              <Text style={styles.stepperSub}>{r.b}</Text>
            </View>
          </View>
        ))}
      </>
    );
    primary = { label: "Continue", onPress: () => go("next") };
  } else if (step === "next") {
    body = (
      <>
        <Text style={styles.question}>Your first two weeks</Text>
        {[
          { icon: "heart-outline", t: "Check in each morning", b: "Sleep, soreness and fatigue give you a readiness score and today's guidance." },
          { icon: "barbell-outline", t: "Log your sessions", b: "Your Train tab, records and progression fill in as you go." },
          { icon: "scale-outline", t: "Weigh in a few times a week", b: "After a couple of weeks your weight trend shows whether you're on pace." },
          { icon: "chatbubble-ellipses-outline", t: "Your coach sees it all", b: "Message them any time from Home or the + button." },
        ].map((r) => (
          <View key={r.t} style={styles.nextRow}>
            <View style={styles.nextIcon}>
              <Ionicons name={r.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepperTitle}>{r.t}</Text>
              <Text style={styles.stepperSub}>{r.b}</Text>
            </View>
          </View>
        ))}
        <View style={{ gap: 10, marginTop: 8 }}>
          <PillButton title="Do today's check-in" variant="secondary" onPress={() => finish("/(tabs)/recovery")} />
          {canGymProfile ? <PillButton title="Set up your gym equipment" variant="secondary" onPress={() => finish("/gym-profile-builder")} /> : null}
          {canGenerate ? <PillButton title="Generate a programme" variant="secondary" onPress={() => finish("/workout-generator")} /> : null}
        </View>
      </>
    );
    primary = { label: "Done", onPress: () => finish() };
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.nav}>
        {step === "building" ? (
          <View style={styles.navBtn} />
        ) : (
          <Pressable onPress={step === "plan" || step === "next" ? () => finish() : back} hitSlop={8} style={styles.navBtn} accessibilityRole="button" accessibilityLabel={step === "plan" || step === "next" ? "Close" : "Back"}>
            <Ionicons name={step === "plan" || step === "next" ? "close" : "chevron-back"} size={26} color={colors.text} />
          </Pressable>
        )}
        <Text style={styles.navTitle}>{qIndex >= 0 ? "Your plan" : ""}</Text>
        {step === "intro" || qIndex >= 0 ? (
          <Pressable onPress={() => finish()} hitSlop={8} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.navBtn} />
        )}
      </View>
      {qIndex >= 0 ? (
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 3, now: qIndex + 1 }}>
          <View style={[styles.progressFill, { width: `${((qIndex + 1) / QUESTION_STEPS.length) * 100}%` }]} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView>

      {primary ? (
        <View style={styles.footer}>
          <Pressable
            onPress={primary.onPress}
            disabled={primary.disabled}
            style={({ pressed }) => [styles.primary, primary.disabled && styles.primaryDisabled, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!primary.disabled }}
          >
            <Text style={[styles.primaryText, primary.disabled && { color: colors.textMuted }]}>{primary.label}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function OptionCard({
  icon,
  label,
  sub,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && styles.optionSel]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Ionicons name={icon} size={26} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSel]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

// Big number with round −/+ buttons (0.5 kg) and ±5 shortcuts.
function WeightDial({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const step = (d: number) => {
    selectionFeedback();
    onChange(clampWeight(value + d));
  };
  return (
    <View style={styles.dial}>
      <Text style={styles.dialLabel}>{label}</Text>
      <View style={styles.dialRow}>
        <Pressable onPress={() => step(-0.5)} style={styles.dialBtn} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`}>
          <Ionicons name="remove" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.dialValue} accessibilityLabel={`${label} ${formatKg(value)} kilograms`}>
          {formatKg(value)}
          <Text style={styles.dialUnit}> kg</Text>
        </Text>
        <Pressable onPress={() => step(0.5)} style={styles.dialBtn} accessibilityRole="button" accessibilityLabel={`Increase ${label}`}>
          <Ionicons name="add" size={26} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.dialChips}>
        {[-5, -1, 1, 5].map((d) => (
          <Pressable key={d} onPress={() => step(d)} style={styles.dialChip} accessibilityRole="button">
            <Text style={styles.dialChipText}>{d > 0 ? `+${d}` : `−${Math.abs(d)}`}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, height: 56 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navTitle: { fontSize: 18, fontWeight: "600", color: c.text },
    skip: { minWidth: 44, height: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    skipText: { fontSize: 16, color: c.textSecondary },
    progress: { height: 4, borderRadius: 2, backgroundColor: c.control, marginHorizontal: AppSpace.gutter, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: c.text, borderRadius: 2 },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingTop: 24, paddingBottom: 32 },
    center: { textAlign: "center" },
    lead: { fontSize: 16, color: c.textSecondary, lineHeight: 23, marginTop: 8 },
    question: { fontSize: 30, fontWeight: "700", color: c.text, lineHeight: 36, marginBottom: 18 },
    subhead: { fontSize: 20, fontWeight: "600", color: c.text, marginTop: 28, marginBottom: 14 },
    error: { fontSize: 15, color: c.danger, marginTop: 16 },

    stepper: { marginTop: 36 },
    stepperRow: { flexDirection: "row", gap: 16 },
    stepperRail: { alignItems: "center", width: 40 },
    stepperDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    stepperDotActive: { backgroundColor: c.primary },
    stepperNum: { fontSize: 16, fontWeight: "700", color: c.text },
    stepperLine: { flex: 1, width: 2, backgroundColor: c.control, marginVertical: 4 },
    stepperTitle: { fontSize: 18, fontWeight: "600", color: c.text, marginTop: 8 },
    stepperSub: { fontSize: 15, color: c.textSecondary, lineHeight: 21, marginTop: 2 },

    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      borderRadius: AppRadius.card,
      borderWidth: 2,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      padding: 18,
      marginBottom: 12,
    },
    optionSel: { borderColor: c.text },
    optionLabel: { fontSize: 18, fontWeight: "600", color: c.text },
    optionSub: { fontSize: 15, color: c.textSecondary, marginTop: 2 },
    radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c.textMuted, alignItems: "center", justifyContent: "center" },
    radioSel: { borderColor: c.text, backgroundColor: c.text },
    radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.bg },

    infoRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16, marginBottom: 12 },
    infoText: { flex: 1, fontSize: 15, color: c.text },
    dial: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16, marginBottom: 12 },
    dialLabel: { fontSize: 15, color: c.textSecondary, textAlign: "center" },
    dialRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
    dialBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    dialValue: { fontSize: 44, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    dialUnit: { fontSize: 20, fontWeight: "400", color: c.textSecondary },
    dialChips: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 12 },
    dialChip: { minWidth: 56, minHeight: 36, borderRadius: 18, backgroundColor: c.control, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    dialChipText: { fontSize: 15, fontWeight: "600", color: c.text },
    gapPill: { alignSelf: "center", borderRadius: AppRadius.control, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
    gapText: { fontSize: 16, fontWeight: "600", color: c.text },

    dayRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
    day: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    daySel: { backgroundColor: c.primary },
    dayText: { fontSize: 18, fontWeight: "600", color: c.text },

    buildRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 58,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    buildText: { fontSize: 18, color: c.text },
    buildTick: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.success, alignItems: "center", justifyContent: "center" },
    buildPending: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: c.control },

    tiles: { flexDirection: "row", gap: 10 },
    tile: { flex: 1, backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16 },
    tileValue: { fontSize: 24, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    tileLabel: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    explainRow: { flexDirection: "row", gap: 16 },
    explainNum: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    explainValue: { fontSize: 17, fontWeight: "600", color: c.text, marginTop: 2 },

    nextRow: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 18 },
    nextIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", marginTop: 4 },

    footer: { paddingHorizontal: AppSpace.gutter, paddingTop: 8, paddingBottom: 12 },
    primary: { minHeight: 56, borderRadius: AppRadius.control, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
    primaryDisabled: { backgroundColor: c.control },
    primaryText: { fontSize: 18, fontWeight: "600", color: c.onPrimary },
  })
);
