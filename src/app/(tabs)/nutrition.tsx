import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PillButton, RoundIconButton, SectionTitle } from "@/components/app/primitives";
import { DayCompleteCard } from "@/components/nutrition/DayCompleteCard";
import { TrainingTipCard } from "@/components/nutrition/TrainingTipCard";
import { BodyWeightCard } from "@/components/ui/BodyWeightCard";
import { Card } from "@/components/ui/Card";
import { ContinueWorkoutPill } from "@/components/ui/ContinueWorkoutPill";
import { InfoModal } from "@/components/ui/InfoModal";
import { WaterAdjuster } from "@/components/nutrition/WaterAdjuster";
import { OptionPicker, type PickerOption } from "@/components/ui/OptionPicker";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import type { MacroKind } from "@/components/ui/MacroPieChart";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Segmented } from "@/components/ui/Segmented";
import { UpsellCard } from "@/components/ui/Upsell";
import { AppRadius, AppSpace, appTitle, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { selectionFeedback, successFeedback, tapFeedback, warningFeedback } from "@/lib/haptics";
import { hasAccess } from "@/lib/member-access";
import { useFoodFavorites, useRemoveFoodFavorite, type FoodFavorite } from "@/lib/queries/food-favorites";
import { useMemberAccess, useHasFeature } from "@/lib/queries/profile";
import { useReduceMotionPref } from "@/lib/use-reduce-motion";
import {
  MEAL_TYPE_OPTIONS,
  useCreateFoodEntry,
  useDeleteFoodEntry,
  useHydration,
  useLogWater,
  useMyNutritionTarget,
  useNutritionDiary,
  useRecentFoods,
  type MealType,
} from "@/lib/queries/nutrition-diary";
import {
  useApplyNutritionTargetOverride,
  useNutrition,
  useSendNutritionCoachMessage,
  type FoodItem,
  type NutritionAiMessage,
} from "@/lib/queries/nutrition";
import { extractTargetProposal, type TargetProposal } from "@/lib/nutrition-target-proposal";
import { calorieExplanation } from "@/lib/calorie-explanation";
import { classifyLoad, LOAD_BAND_LABEL } from "@/lib/nutrition-calc";
import { todayDateString } from "@/lib/workout-formatters";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { tourTarget, useTourScroll } from "@/lib/tour-registry";
import { notInPlanCopy, CAN_SELL_DIGITAL_PLAN, DIGITAL_PLAN_ROUTE } from "@/lib/upsell-config";
import { DEFAULT_DRINK, DRINK_TYPES, drinkNote, findDrink, waterEquivalentMl, type DrinkId } from "@/lib/drink-types";
import { reportTouch } from "@/lib/outside-touch";
import { useWaterAmount, waterQuickAdds } from "@/lib/water-amount";

function shiftDate(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  if (dateISO === shiftDate(today, -1)) return "Yesterday";
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function defaultMealTypeForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

const MACRO_INFO: Record<MacroKind, { title: string; body: string }> = {
  protein: {
    title: "Protein",
    body:
      "The raw material for repairing and building muscle after training. Spread it across the day — chicken, fish, eggs, dairy, tofu, legumes — rather than one big serving, since your body can only put so much to use at once. It's also the most filling of the three macros.",
  },
  carbs: {
    title: "Carbs",
    body:
      "Your body's preferred fuel for training, especially anything above a light walk. They refill the glycogen your muscles burn through during a session. Time more of them around training, and lean on wholegrain, fruit, and vegetable sources for fibre and steadier energy the rest of the day.",
  },
  fat: {
    title: "Fat",
    body:
      "Essential for hormone production and absorbing vitamins A, D, E and K. At roughly double the calories per gram of protein or carbs, it's easy to under- or overshoot without noticing. Favour unsaturated sources — olive oil, nuts, avocado, oily fish — over heavily processed fats.",
  },
};

// Target is 1ml water per kcal in the daily calorie target above (same
// number, so it can't disagree) — 2805 kcal target means 2.8L. Falls back to
// a generic "no target yet" message when the calorie target itself isn't
// available (cold start, no weight on file, or the coach has it disabled).
// The bottle itself (LiquidBottle) starts empty and fills towards the goal as
// the member logs drinks, and is full once the target is reached. Past target it
// just stays full; the text above is what carries the "you went over" info
// ("2.5L / 2.2L"). The liquid moves with the phone.
const HYDRATION_INFO_BODY =
  "Every calorie your body burns costs roughly 1ml of water to process — so your target tracks your energy needs, " +
  "not a flat \"drink 2 litres\" rule. Food counts toward it too: fruit, vegetables, dairy, and most cooked meals are " +
  "60–90% water, so a good chunk of today's target is already covered before you've had a sip.";

const DRINK_PICKER_OPTIONS: readonly PickerOption<DrinkId>[] = DRINK_TYPES.map((d) => ({
  value: d.id,
  label: d.label,
  color: d.color,
  hint: d.share < 1 ? `Counts as ${Math.round(d.share * 100)}% towards your goal` : undefined,
}));

function HydrationCard({ date }: { date: string }) {
  const waterAmount = useWaterAmount();
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { data: hydration } = useHydration(date);
  const logWater = useLogWater();
  const reduceMotion = useReduceMotionPref();
  const [showInfo, setShowInfo] = useState(false);
  // What the quick-add buttons log. The server keeps one water-equivalent total,
  // so a drink is converted before it is sent (see lib/drink-types.ts).
  const [drink, setDrink] = useState<DrinkId>(DEFAULT_DRINK);
  const drinkLine = drinkNote(drink);

  const target = hydration?.targetMl ?? null;
  const logged = hydration?.loggedMl ?? 0;

  // Distinguishes "exactly on target" from "over target" — both used to
  // collapse into the same "target hit" copy once remainingPct clamped to 0,
  // which read the same for someone 50ml over as someone 500ml over. Rounds
  // to the same one-decimal precision as the headline metric so a target
  // that isn't a round ml value (e.g. 2099ml) doesn't show "0.0L over" next
  // to a headline that reads as an exact match.
  const statusText = useMemo(() => {
    if (!target || target <= 0) return null;
    const diffMl = target - logged;
    const diffL = Math.round(Math.abs(diffMl) / 100) / 10;
    if (diffMl > 0) return `${diffL.toFixed(1)}L remaining today`;
    if (diffL === 0) return "Target hit — nice work.";
    return `Target hit — ${diffL.toFixed(1)}L over.`;
  }, [target, logged]);

  return (
    <Card style={styles.hydrationCard}>
      <View style={styles.hydrationLabelRow}>
        <Ionicons name="water-outline" size={16} color={colors.textMuted} />
        <Text style={styles.hydrationLabel}>Hydration</Text>
        <Pressable onPress={() => setShowInfo(true)} hitSlop={10} style={styles.hydrationInfoButton}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.hydrationMetricValue}>
        {(logged / 1000).toFixed(1)}L
        {target ? <Text style={styles.hydrationMetricTarget}> of {(target / 1000).toFixed(1)}L</Text> : null}
      </Text>

      <WaterAdjuster
        loggedMl={logged}
        targetMl={target}
        share={findDrink(drink).share}
        drinkLabel={findDrink(drink).label}
        reduceMotion={reduceMotion}
        statusText={statusText}
        noTargetText="No calorie target yet, so there's nothing to base a hydration target on. Set one up in the card above."
        onSave={(totalMl) => logWater.mutate({ date, setMl: totalMl })}
      />

      <View style={styles.hydrationDrinkScroll}>
        <OptionPicker<DrinkId>
          label="Drink"
          title="What are you drinking?"
          options={DRINK_PICKER_OPTIONS}
          value={drink}
          onChange={setDrink}
        />
      </View>
      {drinkLine ? <Text style={styles.hydrationDrinkNote}>{drinkLine}</Text> : null}

      <View style={styles.hydrationQuickAddRow}>
        {waterQuickAdds(waterAmount).map((ml) => {
          // The member's own usual amount (Settings > Water) comes first and is the highlighted one.
          const isRecommended = ml === waterAmount;
          return (
            <Pressable
              key={ml}
              onPress={() => {
                successFeedback();
                logWater.mutate({ date, deltaMl: waterEquivalentMl(ml, drink) });
              }}
              style={({ pressed }) => [
                styles.hydrationChip,
                isRecommended && styles.hydrationChipPrimary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.hydrationChipText, isRecommended && styles.hydrationChipTextPrimary]}>
                +{ml}ml
              </Text>
            </Pressable>
          );
        })}
      </View>

      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} title="Hydration" body={HYDRATION_INFO_BODY} />
    </Card>
  );
}

function EmphasisRow({
  icon,
  tone,
  title,
  text,
  divider = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: "hydration" | "fuel" | "recovery";
  title: string;
  text: string;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { data: dc } = useAppTheme();
  // One data hue per topic, as a soft disc behind the icon.
  const hue = tone === "hydration" ? dc.hydration : tone === "fuel" ? dc.carbs : dc.readinessHigh;
  return (
    <View style={[styles.emphasisRow, divider && styles.rowDivider]}>
      <View style={[styles.emphasisIconWrap, { backgroundColor: `${hue}2e` }]}>
        <Ionicons name={icon} size={18} color={hue} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.emphasisTitle}>{title}</Text>
        <Text style={styles.emphasisText}>{text}</Text>
      </View>
    </View>
  );
}

// Long assistant replies land as a wall of text otherwise — clamp to a
// short takeaway with a single "Show more" reveal, one level deep, rather
// than dumping the full generated response at once.
const ASSISTANT_CLAMP_CHARS = 220;

function AssistantMessageText({ text }: { text: string }) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > ASSISTANT_CLAMP_CHARS;

  return (
    <>
      <Text style={styles.bubbleAssistantText} numberOfLines={isLong && !expanded ? 3 : undefined}>
        {text}
      </Text>
      {isLong ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6} style={{ marginTop: 4 }}>
          <Text style={styles.showMoreText}>{expanded ? "Show less" : "Show more"}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function CoachChat({
  configured,
  initialMessages,
}: {
  configured: boolean;
  initialMessages: NutritionAiMessage[];
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const [messages, setMessages] = useState<NutritionAiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applyingMsgId, setApplyingMsgId] = useState<string | null>(null);
  const [appliedMsgIds, setAppliedMsgIds] = useState<Set<string>>(new Set());
  const send = useSendNutritionCoachMessage();
  const applyOverride = useApplyNutritionTargetOverride();
  const seeded = useRef(false);
  const access = useMemberAccess();

  async function handleApplyProposal(msgId: string, proposal: TargetProposal) {
    setApplyingMsgId(msgId);
    setError(null);
    try {
      await applyOverride.mutateAsync(proposal);
      setAppliedMsgIds((prev) => new Set(prev).add(msgId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not apply that target. Please try again.");
    } finally {
      setApplyingMsgId(null);
    }
  }

  useEffect(() => {
    if (!seeded.current && initialMessages.length > 0) {
      setMessages(initialMessages);
      seeded.current = true;
    }
  }, [initialMessages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || send.isPending) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() }]);
    try {
      const reply = await send.mutateAsync(content);
      setMessages((prev) => [...prev, { id: `local-${Date.now()}-a`, role: "assistant", content: reply, createdAt: new Date().toISOString() }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  if (!hasAccess(access, "aiNutritionCoachChat")) {
    return (
      <UpsellCard
        icon="chatbubble-ellipses-outline"
        title="Nutrition Coach"
        body={notInPlanCopy("Chat with the Nutrition Coach")}
      />
    );
  }

  if (!configured) {
    return (
      <Card style={styles.chatCard}>
        <Text style={styles.chatUnavailable}>The Nutrition Coach isn&apos;t available right now.</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.chatCard}>
      <Text style={styles.chatTitle}>Nutrition Coach</Text>
      <View style={styles.chatMessages}>
        {messages.length === 0 ? (
          <Text style={styles.chatEmpty}>Ask about meal timing, fuelling for a session, or your macros — grounded in your own training and recovery data.</Text>
        ) : (
          messages.slice(-12).map((m) => {
            const { cleanText, proposal } = m.role === "assistant" ? extractTargetProposal(m.content) : { cleanText: m.content, proposal: null };
            const applied = appliedMsgIds.has(m.id);
            return (
              <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
                {m.role === "user" ? (
                  <Text style={styles.bubbleUserText}>{cleanText}</Text>
                ) : (
                  <AssistantMessageText text={cleanText} />
                )}
                {proposal ? (
                  <View style={styles.proposalBlock}>
                    <Text style={styles.proposalSummary}>
                      {proposal.calories} kcal · {proposal.proteinG}g protein · {proposal.carbsG}g carbs · {proposal.fatG}g fat
                    </Text>
                    <Pressable
                      onPress={() => handleApplyProposal(m.id, proposal)}
                      disabled={applied || applyingMsgId === m.id}
                      style={[styles.applyButton, (applied || applyingMsgId === m.id) && styles.applyButtonDisabled]}
                    >
                      <Text style={styles.applyButtonText}>
                        {applied ? "Target applied" : applyingMsgId === m.id ? "Applying…" : "Apply this target"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
        {send.isPending ? <ActivityIndicator color={colors.text} style={{ marginTop: Spacing.sm }} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.chatInputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask the coach…"
          placeholderTextColor={colors.textMuted}
          style={styles.chatInput}
          multiline
          onSubmitEditing={handleSend}
        />
        <Pressable
          onPress={() => {
            tapFeedback();
            handleSend();
          }}
          disabled={send.isPending || !input.trim()}
          style={[styles.sendButton, (send.isPending || !input.trim()) && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Ionicons name="arrow-up" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>
    </Card>
  );
}

export default function NutritionScreen() {
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();
  const router = useRouter();
  const access = useMemberAccess();
  const today = todayDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [macroInfo, setMacroInfo] = useState<MacroKind | null>(null);
  const [showCalorieWhy, setShowCalorieWhy] = useState(false);
  const [quickAddTab, setQuickAddTab] = useState<"recent" | "favourites">("recent");
  // Collapsed by default — a member who logs a lot of foods can otherwise
  // end up scrolling past a long, always-expanded list for every meal just
  // to reach the next section. Empty meals don't need a collapse state at
  // all (tapping one always means "add"), so this only ever tracks meals
  // that actually have entries.
  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(new Set());

  const { data, isLoading, isError, refetch, isRefetching } = useNutrition();
  const { data: target } = useMyNutritionTarget();
  // Daily calorie and macro targets are part of the App Subscription; Free still logs and sees what it has eaten.
  const canTargets = useHasFeature("calorieTargets");
  const { data: diary } = useNutritionDiary(selectedDate);
  const { data: recentFoods } = useRecentFoods();
  const { data: favorites } = useFoodFavorites();
  const removeFavorite = useRemoveFoodFavorite();
  const createEntry = useCreateFoodEntry();
  const deleteEntry = useDeleteFoodEntry();

  // Always-visible delete button, not onLongPress — inside a horizontal
  // ScrollView, the scroll gesture's own responder negotiation regularly
  // swallows long-press recognition entirely (confirmed elsewhere in this
  // app, see log-food.tsx's favourites chips, which hit the exact same
  // issue first).
  function confirmRemoveFavorite(f: FoodFavorite) {
    warningFeedback();
    Alert.alert("Remove favourite?", `"${f.name}" will be removed from your favourites.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeFavorite.mutate(f.id) },
    ]);
  }

  function toggleMealExpanded(mealType: MealType) {
    tapFeedback();
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealType)) next.delete(mealType);
      else next.add(mealType);
      return next;
    });
  }

  function handleQuickAdd(food: { name: string; calories: number; proteinG: number; carbsG: number; fatG: number }) {
    successFeedback();
    createEntry.mutate({
      date: selectedDate,
      mealType: defaultMealTypeForNow(),
      name: food.name,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
    });
  }

  function addFood(mealType?: MealType) {
    router.push({ pathname: "/log-food", params: mealType ? { date: selectedDate, mealType } : { date: selectedDate } });
  }

  const scrollRef = useRef<ScrollView>(null);
  useTourScroll("nutrition", scrollRef);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load nutrition data.</Text>
          <PillButton title="Try again" variant="secondary" onPress={() => refetch()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  // Readiness-aware hydration line (Recovery data → messaging) — mirrors
  // the web Nutrition tab's "Today's emphasis" copy verbatim.
  const hydrationLine =
    data.readinessScore === null
      ? "No recovery log today — log it in the Recovery tab so fuelling and hydration guidance can react to how you're actually recovering."
      : data.readinessScore < 50
        ? `Readiness is ${data.readinessScore} — prioritise fluids and add electrolytes with meals today; low readiness often tracks with poor hydration and sleep.`
        : data.readinessScore < 75
          ? `Readiness is ${data.readinessScore} — steady fluids through the day; front-load them earlier rather than catching up tonight.`
          : `Readiness is ${data.readinessScore} — recovery looks good; normal fluid rhythm with meals and training covers today.`;

  const weekBand = classifyLoad(data.sevenDayLoad, data.daysWithLoad);
  const trainingLine =
    weekBand === "high"
      ? `Your 7-day load is ${LOAD_BAND_LABEL[weekBand].toLowerCase()} — protect carbs around sessions and don't train fasted this week.`
      : data.lastSessionTitle
        ? `Last logged session: ${data.lastSessionTitle}${data.lastSessionDate ? ` (${data.lastSessionDate})` : ""}. Time most of today's carbs before and after training windows.`
        : "No workouts logged yet — once sessions are in the Workouts tab, fuelling emphasis follows your real training.";

  const consumed = diary?.totals.calories ?? 0;
  const hasTarget = !!target && target.mode !== "disabled" && target.calories !== null;
  const remaining = hasTarget ? target!.calories! - consumed : 0;
  const atToday = selectedDate === today;

  return (
    // Every touch is reported so the water bottle, when switched on for dragging, can save when the member taps anywhere else.
    <SafeAreaView style={styles.safe} edges={["top"]} onTouchStart={(e) => reportTouch(e.nativeEvent.pageX, e.nativeEvent.pageY)}>
      <KeyboardAwareScroll
        ref={scrollRef as never}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.text} />}
      >
        <View {...tourTarget("nutrition.top")} />
        <View style={styles.band}>
          <View style={styles.headerRow}>
            <Text style={appTitle(34, colors.text)}>Nutrition</Text>
            <View style={styles.headerActions}>
              <ContinueWorkoutPill />
              <RoundIconButton icon="barcode-outline" label="Scan a barcode" onPress={() => router.push("/barcode-scan")} />
            </View>
          </View>

          <View style={styles.dateNav}>
            <Pressable
              onPress={() => {
                selectionFeedback();
                setSelectedDate((d) => shiftDate(d, -1));
              }}
              hitSlop={6}
              style={styles.dateArrow}
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.dateLabel}>{formatDateLabel(selectedDate, today)}</Text>
            <Pressable
              onPress={() => {
                if (atToday) return;
                selectionFeedback();
                setSelectedDate((d) => shiftDate(d, 1));
              }}
              hitSlop={6}
              style={[styles.dateArrow, atToday && { opacity: 0.35 }]}
              disabled={atToday}
              accessibilityRole="button"
              accessibilityLabel="Next day"
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Pressable
            {...tourTarget("nutrition.calories")}
            onPress={() => (canTargets ? router.push("/nutrition-targets") : CAN_SELL_DIGITAL_PLAN ? router.push(DIGITAL_PLAN_ROUTE as never) : undefined)}
            accessibilityRole="button"
            accessibilityLabel={canTargets ? "Calories and targets" : "Calories. Daily targets are part of the App Subscription"}
          >
            <View style={styles.calHead}>
              <Text style={styles.calLabel}>{hasTarget && target?.fuelDayLabel ? target.fuelDayLabel : "Calories"}</Text>
              <View style={styles.calLink}>
                <Text style={styles.calLinkText}>{canTargets ? "Day · Week" : "Targets"}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </View>
            <Text style={styles.calValue}>
              {consumed.toLocaleString()}
              <Text style={styles.calUnit}>{hasTarget ? ` / ${target!.calories!.toLocaleString()} kcal` : " kcal logged"}</Text>
            </Text>
            {hasTarget ? (
              <>
                <Text style={styles.calRemaining}>
                  {remaining >= 0 ? `${remaining.toLocaleString()} kcal remaining` : `${Math.abs(remaining).toLocaleString()} kcal over`}
                </Text>
                <View style={{ marginTop: 10 }}>
                  <ProgressBar pct={(consumed / target!.calories!) * 100} color={colors.text} />
                </View>
                <Pressable
                  onPress={() => {
                    tapFeedback();
                    setShowCalorieWhy(true);
                  }}
                  hitSlop={8}
                  style={styles.whyLink}
                  accessibilityRole="button"
                  accessibilityLabel="Why is my calorie target this number?"
                >
                  <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.whyLinkText}>Why this number?</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.calRemaining}>
                {!canTargets
                  ? "A daily calorie and macro target that adapts to your training is part of the App Subscription."
                  : target?.mode === "disabled"
                    ? "Your coach has turned off daily targets for now — logging still works."
                    : "Setting up your target — add your weight in Profile so we can calculate it."}
              </Text>
            )}
          </Pressable>

          {hasTarget ? (
            <View style={styles.macroRow} {...tourTarget("nutrition.macros")}>
              <MacroBar label="Protein" consumed={diary?.totals.proteinG ?? 0} target={target!.proteinG} color={dc.protein} onPress={() => setMacroInfo("protein")} />
              <MacroBar label="Carbs" consumed={diary?.totals.carbsG ?? 0} target={target!.carbsG} color={dc.carbs} onPress={() => setMacroInfo("carbs")} />
              <MacroBar label="Fat" consumed={diary?.totals.fatG ?? 0} target={target!.fatG} color={dc.fat} onPress={() => setMacroInfo("fat")} />
            </View>
          ) : null}

          <View style={{ marginTop: 18 }} {...tourTarget("nutrition.log")}>
            <PillButton title="Log food" onPress={() => addFood()} />
          </View>
        </View>

        <View style={styles.body}>
          <TrainingTipCard target={target} />

          {/* Diary */}
          <View style={styles.section} {...tourTarget("nutrition.diary")}>
            <SectionTitle title="Diary" action="Add food" onAction={() => addFood()} />
            <View style={styles.list}>
              {MEAL_TYPE_OPTIONS.map((meal, mealIdx) => {
                const mealEntries = (diary?.entries ?? []).filter((e) => e.mealType === meal.value);
                const mealCals = mealEntries.reduce((s, e) => s + e.calories, 0);
                const hasEntries = mealEntries.length > 0;
                const isExpanded = expandedMeals.has(meal.value);
                return (
                  <View key={meal.value} style={mealIdx > 0 && styles.rowDivider}>
                    <View style={styles.mealRow}>
                      <Pressable
                        onPress={() => (hasEntries ? toggleMealExpanded(meal.value) : addFood(meal.value))}
                        style={styles.mealMain}
                        accessibilityRole="button"
                        accessibilityState={hasEntries ? { expanded: isExpanded } : undefined}
                        accessibilityLabel={hasEntries ? `${meal.label}, ${mealCals} kcal` : `Add ${meal.label}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{meal.label}</Text>
                          <Text style={styles.rowSub}>
                            {hasEntries
                              ? `${mealCals} kcal · ${mealEntries.length} item${mealEntries.length === 1 ? "" : "s"}`
                              : "Nothing logged"}
                          </Text>
                        </View>
                        {hasEntries ? <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} /> : null}
                      </Pressable>
                      <Pressable
                        onPress={() => addFood(meal.value)}
                        style={styles.mealAdd}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`Add food to ${meal.label}`}
                      >
                        <Ionicons name="add" size={20} color={colors.text} />
                      </Pressable>
                    </View>
                    {hasEntries && isExpanded
                      ? mealEntries.map((e) => (
                          <View key={e.id} style={styles.entryRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.entryName}>{e.name}</Text>
                              <View style={styles.entryMacros}>
                                <Text style={styles.entryKcal}>{e.calories} kcal</Text>
                                <MacroChip letter="P" value={e.proteinG} color={dc.protein} />
                                <MacroChip letter="C" value={e.carbsG} color={dc.carbs} />
                                <MacroChip letter="F" value={e.fatG} color={dc.fat} />
                              </View>
                            </View>
                            <Pressable
                              onPress={() => {
                                warningFeedback();
                                deleteEntry.mutate({ id: e.id, date: selectedDate });
                              }}
                              hitSlop={10}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${e.name}`}
                            >
                              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        ))
                      : null}
                  </View>
                );
              })}
            </View>
            <DayCompleteCard
              date={selectedDate}
              dayStatus={diary?.dayStatus}
              hasEntries={(diary?.entries.length ?? 0) > 0}
              isFuture={selectedDate > today}
            />
          </View>

          {/* Quick add */}
          {(recentFoods && recentFoods.length > 0) || (favorites && favorites.length > 0) ? (
            <View style={styles.section}>
              <SectionTitle title="Quick add" />
              <View style={{ marginBottom: 12 }}>
                <Segmented
                  options={["recent", "favourites"] as const}
                  value={quickAddTab}
                  onChange={setQuickAddTab}
                  format={(t) => (t === "recent" ? "Recent" : "Favourites")}
                />
              </View>
              {quickAddTab === "recent" ? (
                (recentFoods?.length ?? 0) > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                    {recentFoods!.slice(0, 10).map((f) => (
                      <Pressable
                        key={f.id}
                        onPress={() => handleQuickAdd(f)}
                        style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${f.name}, ${f.calories} kcal`}
                      >
                        <Text style={styles.quickChipText} numberOfLines={2}>
                          {f.name}
                        </Text>
                        <View style={styles.quickChipFoot}>
                          <Text style={styles.quickChipSub}>{f.calories} kcal</Text>
                          <Ionicons name="add-circle" size={20} color={colors.text} />
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.quietText}>Nothing logged recently.</Text>
                )
              ) : (favorites?.length ?? 0) > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                  {favorites!.map((f: FoodFavorite) => (
                    <View key={f.id} style={styles.quickChip}>
                      <Pressable onPress={() => handleQuickAdd(f)} accessibilityRole="button" accessibilityLabel={`Add ${f.name}, ${f.calories} kcal`} style={{ flex: 1 }}>
                        <Text style={[styles.quickChipText, { paddingRight: 18 }]} numberOfLines={2}>
                          {f.name}
                        </Text>
                        <View style={styles.quickChipFoot}>
                          <Text style={styles.quickChipSub}>{f.calories} kcal</Text>
                          <Ionicons name="add-circle" size={20} color={colors.text} />
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmRemoveFavorite(f)}
                        hitSlop={10}
                        style={styles.quickChipDelete}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${f.name} from favourites`}
                      >
                        <Ionicons name="close" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.quietText}>No favourites yet — save one from the star icon when adding a food.</Text>
              )}
            </View>
          ) : null}

          {/* Hydration */}
          <View style={styles.section} {...tourTarget("nutrition.hydration")}>
            <SectionTitle title="Hydration" />
            <HydrationCard date={selectedDate} />
          </View>

          {/* Emphasis */}
          <View style={styles.section}>
            <SectionTitle title="Today's emphasis" />
            <View style={styles.list}>
              <EmphasisRow icon="water-outline" tone="hydration" title="Hydration" text={hydrationLine} />
              <EmphasisRow icon="flash-outline" tone="fuel" title="Training fuel" text={trainingLine} divider />
              <EmphasisRow
                icon="heart-outline"
                tone="recovery"
                title="Micros & recovery"
                text="Spread protein across 3–4 meals, get colour on every plate for micronutrients, and keep the last big meal 2–3 hours before sleep. Repair happens between sessions, not during them."
                divider
              />
            </View>
          </View>

          {/* Weight */}
          <View style={styles.section}>
            <SectionTitle title="Weight check-in" />
            <BodyWeightCard compact />
          </View>

          {/* Tools */}
          <View style={styles.section}>
            <SectionTitle title="More tools" />
            {hasAccess(access, "nutritionMoreTools") ? (
              <View style={styles.list}>
                {TOOL_ROWS.map((r, i) => (
                  <Pressable
                    key={r.href}
                    onPress={() => {
                      tapFeedback();
                      router.push(r.href as never);
                    }}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Ionicons name={r.icon} size={22} color={colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{r.title}</Text>
                      <Text style={styles.rowSub}>{r.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <UpsellCard icon="construct-outline" title="More Tools" body="Sports drink calculator, weekly training, meal ideas, and shopping list" />
            )}
          </View>

          <View style={styles.section}>
            <CoachChat configured={data.aiNutritionCoachConfigured} initialMessages={data.initialAiNutritionMessages} />
          </View>
        </View>
      </KeyboardAwareScroll>

      <InfoModal
        visible={showCalorieWhy}
        onClose={() => setShowCalorieWhy(false)}
        title="Your calorie target"
        body={calorieExplanation(target)}
      />
      <InfoModal
        visible={macroInfo !== null}
        onClose={() => setMacroInfo(null)}
        title={macroInfo ? MACRO_INFO[macroInfo].title : ""}
        body={macroInfo ? MACRO_INFO[macroInfo].body : ""}
      />
    </SafeAreaView>
  );
}

const TOOL_ROWS: { href: string; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { href: "/drink-calculator", icon: "water-outline", title: "Sports drink calculator", sub: "Sport, sweat rate and conditions, tailored to you" },
  { href: "/weekly-training", icon: "calendar-outline", title: "Weekly training", sub: "Your typical week: gym, sport, anything else" },
  { href: "/meal-suggest", icon: "camera-outline", title: "What can I make?", sub: "Photo or list your ingredients for meal ideas" },
  { href: "/shopping-list", icon: "cart-outline", title: "Shopping list", sub: "Your list, plus ingredients from saved recipes" },
];

// One macro: label, consumed / target, and a bar in the macro's data colour.
function MacroBar({ label, consumed, target, color, onPress }: { label: string; consumed: number; target: number | null; color: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={styles.macro}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${Math.round(consumed)} of ${target ?? "no target"} grams. About ${label}.`}
    >
      <View style={styles.macroHead}>
        <View style={[styles.macroDot, { backgroundColor: color }]} />
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
      <Text style={styles.macroValue}>
        {Math.round(consumed)}
        <Text style={styles.macroUnit}>{target ? ` / ${target}g` : "g"}</Text>
      </Text>
      <ProgressBar pct={target ? (consumed / target) * 100 : 0} color={color} />
    </Pressable>
  );
}

function MacroChip({ letter, value, color }: { letter: string; value: number; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.macroChip}>
      <View style={[styles.macroChipDot, { backgroundColor: color }]} />
      <Text style={styles.macroChipText}>
        {letter} {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c, dc) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    errorText: { color: c.textMuted, fontSize: 16 },
    scroll: { paddingBottom: 40 },
    pressed: { opacity: 0.85 },

    band: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingHorizontal: AppSpace.gutter,
      paddingBottom: 20,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      alignSelf: "center",
      marginTop: 14,
      marginBottom: 16,
      backgroundColor: c.control,
      borderRadius: AppRadius.control,
      padding: 4,
      minWidth: 220,
    },
    dateArrow: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    dateLabel: { fontSize: 16, fontWeight: "600", color: c.text, textAlign: "center", flex: 1 },
    calHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    calLabel: { fontSize: 15, color: c.textMuted },
    calLink: { flexDirection: "row", alignItems: "center", gap: 2 },
    calLinkText: { fontSize: 14, color: c.textMuted },
    calValue: { fontSize: 40, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"], marginTop: 2 },
    calUnit: { fontSize: 17, fontWeight: "400", color: c.textSecondary },
    whyLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44, marginTop: 4 },
    whyLinkText: { fontSize: 15, fontWeight: "500", color: c.textSecondary, textDecorationLine: "underline" },
    calRemaining: { fontSize: 15, color: c.textSecondary, marginTop: 2, lineHeight: 21 },
    macroRow: { flexDirection: "row", gap: 10, marginTop: 18 },
    macro: { flex: 1, backgroundColor: c.surfaceHi, borderRadius: AppRadius.inner + 4, padding: 12, gap: 6 },
    macroHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    macroDot: { width: 8, height: 8, borderRadius: 4 },
    macroLabel: { fontSize: 14, color: c.textSecondary },
    macroValue: { fontSize: 20, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"] },
    macroUnit: { fontSize: 13, fontWeight: "400", color: c.textMuted },

    body: { paddingHorizontal: AppSpace.gutter, paddingTop: AppSpace.section },
    section: { marginBottom: AppSpace.section },
    list: { backgroundColor: c.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    rowTitle: { fontSize: 16, color: c.text },
    rowSub: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    quietText: { fontSize: 15, color: c.textMuted },

    mealRow: { flexDirection: "row", alignItems: "center", paddingRight: 10 },
    mealMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 62, paddingLeft: 16, paddingRight: 6, paddingVertical: 10 },
    mealAdd: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    entryName: { fontSize: 15, color: c.text },
    entryMacros: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 },
    entryKcal: { fontSize: 13, color: c.textMuted, fontVariant: ["tabular-nums"] },
    macroChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    macroChipDot: { width: 6, height: 6, borderRadius: 3 },
    macroChipText: { fontSize: 13, color: c.textMuted, fontVariant: ["tabular-nums"] },

    quickRow: { gap: 10 },
    quickChip: { width: 132, minHeight: 92, backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 12 },
    quickChipText: { fontSize: 15, color: c.text, lineHeight: 20 },
    quickChipFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 8 },
    quickChipSub: { fontSize: 13, color: c.textMuted },
    quickChipDelete: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

    // Hydration card
    hydrationCard: { padding: 16 },
    hydrationLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
    hydrationLabel: { fontSize: 15, color: c.textMuted },
    hydrationInfoButton: { padding: 2 },
    hydrationMetricValue: { fontSize: 32, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"], marginBottom: 10 },
    hydrationMetricTarget: { fontSize: 16, fontWeight: "400", color: c.textMuted },
    hydrationEmptyText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
    hydrationBodyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    hydrationSideCol: { flex: 1 },
    hydrationSideText: { fontSize: 16, fontWeight: "500", color: c.textSecondary, lineHeight: 22 },
    hydrationDrinkScroll: { marginTop: 16, marginHorizontal: -16 },
    hydrationDrinkRow: { gap: 8, paddingHorizontal: 16 },
    hydrationDrinkChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 19,
      borderWidth: 1.5,
      borderColor: "transparent",
      backgroundColor: c.control,
    },
    hydrationDrinkDot: { width: 10, height: 10, borderRadius: 5 },
    hydrationDrinkText: { fontSize: 14, color: c.textMuted },
    hydrationDrinkTextActive: { color: c.text, fontWeight: "600" },
    hydrationDrinkNote: { fontSize: 13, color: c.textMuted, marginTop: 8 },
    hydrationQuickAddRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    hydrationChip: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: AppRadius.control, backgroundColor: c.control },
    // The recommended +500ml is the one solid pill.
    hydrationChipPrimary: { backgroundColor: c.primary },
    hydrationChipText: { fontSize: 15, fontWeight: "600", color: c.text },
    hydrationChipTextPrimary: { color: c.onPrimary },
    hydrationManualDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginTop: 16 },
    hydrationManualLabel: { fontSize: 14, color: c.textMuted, marginTop: 12, marginBottom: 6 },
    hydrationManualRow: { flexDirection: "row", gap: 8 },
    hydrationManualInput: {
      flex: 1,
      height: 46,
      borderRadius: AppRadius.inner + 2,
      backgroundColor: c.control,
      paddingHorizontal: 14,
      fontSize: 16,
      color: c.text,
    },
    hydrationManualButton: { justifyContent: "center", borderRadius: AppRadius.control, backgroundColor: c.primary, paddingHorizontal: 20, minHeight: 46 },
    hydrationManualButtonDisabled: { opacity: 0.4 },
    hydrationManualButtonText: { fontSize: 15, fontWeight: "600", color: c.onPrimary },
    hydrationManualError: { fontSize: 14, color: c.danger, marginTop: 6 },

    // Emphasis
    emphasisRow: { flexDirection: "row", gap: 14, padding: 16 },
    emphasisIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    emphasisTitle: { fontSize: 16, fontWeight: "600", color: c.text },
    emphasisText: { fontSize: 15, color: c.textSecondary, marginTop: 4, lineHeight: 21 },

    // Coach chat
    chatCard: { padding: 16 },
    chatTitle: { fontSize: 18, fontWeight: "600", color: c.text, marginBottom: 10 },
    chatUnavailable: { fontSize: 15, color: c.textMuted },
    chatMessages: { minHeight: 60, marginBottom: 10 },
    chatEmpty: { fontSize: 15, color: c.textMuted, lineHeight: 21 },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, maxWidth: "85%" },
    bubbleUser: { alignSelf: "flex-end", backgroundColor: c.primary },
    bubbleAssistant: { alignSelf: "flex-start", backgroundColor: c.control },
    bubbleUserText: { fontSize: 15, color: c.onPrimary, lineHeight: 21 },
    bubbleAssistantText: { fontSize: 15, color: c.text, lineHeight: 21 },
    showMoreText: { fontSize: 14, fontWeight: "600", color: c.textSecondary, textDecorationLine: "underline" },
    proposalBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    proposalSummary: { fontSize: 14, color: c.textSecondary },
    applyButton: { marginTop: 8, alignSelf: "flex-start", borderRadius: AppRadius.control, backgroundColor: c.primary, paddingHorizontal: 16, minHeight: 40, justifyContent: "center" },
    applyButtonDisabled: { opacity: 0.6 },
    applyButtonText: { fontSize: 14, fontWeight: "600", color: c.onPrimary },
    error: { fontSize: 14, color: c.danger, marginBottom: 8 },
    chatInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
    chatInput: {
      flex: 1,
      borderRadius: 22,
      backgroundColor: c.control,
      color: c.text,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      maxHeight: 110,
    },
    sendButton: { backgroundColor: c.primary, borderRadius: 22, width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  })
);
