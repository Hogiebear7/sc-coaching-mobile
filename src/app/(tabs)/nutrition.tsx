import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BodyWeightCard } from "@/components/ui/BodyWeightCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InfoModal } from "@/components/ui/InfoModal";
import { MacroLegendRow, MacroPieChart, type MacroKind } from "@/components/ui/MacroPieChart";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { tapFeedback } from "@/lib/haptics";
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
import { useNutrition, useSendNutritionCoachMessage, type FoodItem, type NutritionAiMessage } from "@/lib/queries/nutrition";
import { classifyLoad, LOAD_BAND_LABEL } from "@/lib/nutrition-calc";
import { todayDateString } from "@/lib/workout-formatters";

function shiftDate(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  if (dateISO === shiftDate(today, -1)) return "Yesterday";
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const MEAL_EMPTY_COPY: Record<MealType, string> = {
  breakfast: "Nothing logged — tap + to add what you had this morning.",
  lunch: "Nothing logged — tap + to log lunch and keep today on track.",
  dinner: "Nothing logged — tap + to add dinner when you're ready.",
  snack: "Nothing logged — snacks count too, tap + to add one.",
};

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

const WATER_QUICK_ADDS = [250, 500, 750];
const WATER_RECOMMENDED_ML = 500;
// Generous sanity cap on manual entry — catches the realistic typo (typing
// "15" meaning "1.5") rather than trying to guess a "real" hydration max.
const MANUAL_MAX_ML = 15_000;

// Target is 1ml water per kcal in the daily calorie target above (same
// number, so it can't disagree) — 2805 kcal target means 2.8L. Falls back to
// a generic "no target yet" message when the calorie target itself isn't
// available (cold start, no weight on file, or the coach has it disabled).
// A bottle that starts full (nothing drunk yet) and drains as the member
// logs water — the fill represents what's LEFT to drink, not what's been
// drunk, since "drink from a full bottle over the day" is the metaphor.
// Past target it just reads empty; the text above is what carries the
// "you went over" info ("2.5L / 2.2L"). The fill height eases toward the new
// value instead of jumping — a restrained cue that a tap actually landed —
// and skips the transition entirely when the member has reduce-motion on.
function HydrationBottle({ remainingPct, reduceMotion }: { remainingPct: number; reduceMotion: boolean }) {
  const fillAnim = useRef(new Animated.Value(remainingPct)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: remainingPct,
      duration: reduceMotion ? 0 : 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating height, not transform/opacity
    }).start();
  }, [remainingPct, reduceMotion, fillAnim]);

  const height = fillAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.bottleWrap}>
      <View style={styles.bottleCap} />
      <View style={styles.bottleNeck} />
      <View style={styles.bottleBody}>
        <Animated.View style={[styles.bottleFill, { height }]} />
        {/* Glass-sheen highlight, purely decorative — always sits above the
            fill so it reads at any level, not tied to hydration data. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bottleSheen}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const HYDRATION_INFO_BODY =
  "Every calorie your body burns costs roughly 1ml of water to process — so your target tracks your energy needs, " +
  "not a flat \"drink 2 litres\" rule. Food counts toward it too: fruit, vegetables, dairy, and most cooked meals are " +
  "60–90% water, so a good chunk of today's target is already covered before you've had a sip.";

function HydrationCard({ date }: { date: string }) {
  const { data: hydration } = useHydration(date);
  const logWater = useLogWater();
  const reduceMotion = useReduceMotionPref();
  const [manualEntry, setManualEntry] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const target = hydration?.targetMl ?? null;
  const logged = hydration?.loggedMl ?? 0;
  const remainingPct = target && target > 0 ? Math.max(0, Math.min(100, 100 - (logged / target) * 100)) : 100;

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

  function handleSetManual() {
    const parsed = parseFloat(manualEntry);
    if (!manualEntry.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setManualError("Enter a valid number of litres.");
      return;
    }
    const ml = Math.round(parsed * 1000);
    if (ml > MANUAL_MAX_ML) {
      setManualError("That's more than 15L — check the value.");
      return;
    }
    tapFeedback();
    logWater.mutate({ date, setMl: ml });
    setManualEntry("");
    setManualError(null);
  }

  return (
    <Card style={styles.hydrationCard}>
      <View style={styles.hydrationLabelRow}>
        <Ionicons name="water-outline" size={13} color={Color.textMuted} />
        <Text style={styles.hydrationLabel}>Hydration</Text>
        <Pressable onPress={() => setShowInfo(true)} hitSlop={10} style={styles.hydrationInfoButton}>
          <Ionicons name="information-circle-outline" size={14} color={Color.textFaint} />
        </Pressable>
      </View>

      <Text style={styles.hydrationMetricValue}>
        {(logged / 1000).toFixed(1)}L
        {target ? <Text style={styles.hydrationMetricTarget}> of {(target / 1000).toFixed(1)}L</Text> : null}
      </Text>

      <View style={styles.hydrationBodyRow}>
        <HydrationBottle remainingPct={remainingPct} reduceMotion={reduceMotion} />
        <View style={styles.hydrationSideCol}>
          {target ? (
            <Text style={styles.hydrationSideText}>{statusText}</Text>
          ) : (
            <Text style={styles.hydrationEmptyText}>
              No calorie target yet, so there&apos;s nothing to base a hydration target on — set one up in the card
              above.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.hydrationQuickAddRow}>
        {WATER_QUICK_ADDS.map((ml) => {
          const isRecommended = ml === WATER_RECOMMENDED_ML;
          return (
            <Pressable
              key={ml}
              onPress={() => {
                tapFeedback();
                logWater.mutate({ date, deltaMl: ml });
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

      <View style={styles.hydrationManualDivider} />
      <Text style={styles.hydrationManualLabel}>Or enter manually</Text>
      <View style={styles.hydrationManualRow}>
        <TextInput
          value={manualEntry}
          onChangeText={(v) => {
            setManualEntry(v);
            if (manualError) setManualError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="Enter total litres, e.g. 1.5"
          placeholderTextColor={Color.textFaint}
          style={styles.hydrationManualInput}
          onSubmitEditing={handleSetManual}
          returnKeyType="done"
        />
        <Pressable
          onPress={handleSetManual}
          disabled={!manualEntry.trim()}
          style={({ pressed }) => [
            styles.hydrationManualButton,
            !manualEntry.trim() && styles.hydrationManualButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.hydrationManualButtonText}>Set</Text>
        </Pressable>
      </View>
      {manualError ? <Text style={styles.hydrationManualError}>{manualError}</Text> : null}

      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} title="Hydration" body={HYDRATION_INFO_BODY} />
    </Card>
  );
}

function EmphasisRow({ icon, tone, title, text }: { icon: keyof typeof Ionicons.glyphMap; tone: "neutral" | "gold" | "success"; title: string; text: string }) {
  const toneColor = tone === "gold" ? Color.gold : tone === "success" ? Color.success : Color.textSecondary;
  const toneBorder = tone === "gold" ? Color.goldBorder : tone === "success" ? Color.success : Color.borderSubtle;
  const toneBg = tone === "gold" ? Color.goldWeak : tone === "success" ? Color.successWeak : Color.surface2;
  return (
    <View style={styles.emphasisRow}>
      <View style={[styles.emphasisIconWrap, { borderColor: toneBorder, backgroundColor: toneBg }]}>
        <Ionicons name={icon} size={16} color={toneColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.emphasisTitle}>{title}</Text>
        <Text style={styles.emphasisText}>{text}</Text>
      </View>
    </View>
  );
}

function CoachChat({
  configured,
  initialMessages,
  onFocusInput,
}: {
  configured: boolean;
  initialMessages: NutritionAiMessage[];
  onFocusInput: () => void;
}) {
  const [messages, setMessages] = useState<NutritionAiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendNutritionCoachMessage();
  const seeded = useRef(false);

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

  if (!configured) {
    return (
      <Card style={styles.chatCard}>
        <Text style={styles.chatUnavailable}>AI Nutrition Coach isn&apos;t available right now.</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.chatCard}>
      <Text style={styles.chatTitle}>AI Nutrition Coach</Text>
      <View style={styles.chatMessages}>
        {messages.length === 0 ? (
          <Text style={styles.chatEmpty}>Ask about meal timing, fuelling for a session, or your macros — grounded in your own training and recovery data.</Text>
        ) : (
          messages.slice(-12).map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={m.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>{m.content}</Text>
            </View>
          ))
        )}
        {send.isPending ? <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.sm }} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.chatInputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask the coach…"
          placeholderTextColor={Color.textFaint}
          style={styles.chatInput}
          multiline
          onSubmitEditing={handleSend}
          onFocus={onFocusInput}
        />
        <Pressable onPress={handleSend} disabled={send.isPending || !input.trim()} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function NutritionScreen() {
  const router = useRouter();
  const today = todayDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [macroInfo, setMacroInfo] = useState<MacroKind | null>(null);
  // The coach chat's input sits near the bottom of a long scroll view —
  // KeyboardAvoidingView alone doesn't scroll a *specific* field into view,
  // it only resizes/pads the container, so the keyboard can still end up
  // covering an input that wasn't already on screen when it opened. Scroll
  // to the end on focus since the chat input is always the last thing here.
  const scrollRef = useRef<ScrollView>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useNutrition();
  const { data: target } = useMyNutritionTarget();
  const { data: diary } = useNutritionDiary(selectedDate);
  const { data: recentFoods } = useRecentFoods();
  const createEntry = useCreateFoodEntry();
  const deleteEntry = useDeleteFoodEntry();

  function handleQuickAdd(food: NonNullable<typeof recentFoods>[number]) {
    tapFeedback();
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load nutrition data.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Nutrition</Text>
          </View>

          <View style={styles.dateNavRow}>
            <Pressable onPress={() => setSelectedDate((d) => shiftDate(d, -1))} hitSlop={10} style={styles.dateArrow}>
              <Ionicons name="chevron-back" size={18} color={Color.textSecondary} />
            </Pressable>
            <Text style={styles.dateLabel}>{formatDateLabel(selectedDate, today)}</Text>
            <Pressable
              onPress={() => selectedDate !== today && setSelectedDate((d) => shiftDate(d, 1))}
              hitSlop={10}
              style={styles.dateArrow}
              disabled={selectedDate === today}
            >
              <Ionicons name="chevron-forward" size={18} color={selectedDate === today ? Color.textFaint : Color.textSecondary} />
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/nutrition-targets")}>
            <Card style={styles.targetCard} tier="hero">
              {target && target.mode !== "disabled" && target.calories !== null ? (
                <>
                  <View style={styles.targetHeaderRow}>
                    {target.fuelDayLabel ? <Text style={styles.fuelDayLabel}>{target.fuelDayLabel}</Text> : <View />}
                    <View style={styles.viewWeekRow}>
                      <Text style={styles.viewWeekText}>Day · Week</Text>
                      <Ionicons name="chevron-forward" size={14} color={Color.textFaint} />
                    </View>
                  </View>
                  <View style={styles.calorieRow}>
                    <Text style={styles.calorieValue}>{diary?.totals.calories ?? 0}</Text>
                    <Text style={styles.calorieTarget}> / {target.calories} kcal</Text>
                  </View>
                  <Text style={styles.calorieRemaining}>
                    {target.calories - (diary?.totals.calories ?? 0) >= 0
                      ? `${target.calories - (diary?.totals.calories ?? 0)} kcal remaining`
                      : `${(diary?.totals.calories ?? 0) - target.calories} kcal over`}
                  </Text>
                  <View style={styles.macroBlock}>
                    <MacroPieChart
                      proteinG={diary?.totals.proteinG ?? 0}
                      carbsG={diary?.totals.carbsG ?? 0}
                      fatG={diary?.totals.fatG ?? 0}
                      targetProteinG={target.proteinG}
                      targetCarbsG={target.carbsG}
                      targetFatG={target.fatG}
                      onSlicePress={setMacroInfo}
                    />
                    <View style={styles.macroLegend}>
                      <MacroLegendRow
                        kind="protein"
                        label="Protein"
                        consumed={diary?.totals.proteinG ?? 0}
                        target={target.proteinG}
                        onPress={() => setMacroInfo("protein")}
                      />
                      <MacroLegendRow
                        kind="carbs"
                        label="Carbs"
                        consumed={diary?.totals.carbsG ?? 0}
                        target={target.carbsG}
                        onPress={() => setMacroInfo("carbs")}
                      />
                      <MacroLegendRow
                        kind="fat"
                        label="Fat"
                        consumed={diary?.totals.fatG ?? 0}
                        target={target.fatG}
                        onPress={() => setMacroInfo("fat")}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.calorieRow}>
                    <Text style={styles.calorieValue}>{diary?.totals.calories ?? 0}</Text>
                    <Text style={styles.calorieTarget}> kcal logged</Text>
                  </View>
                  <Text style={styles.noTargetText}>
                    {target?.mode === "disabled"
                      ? "Your coach has turned off daily targets for now — logging still works."
                      : "Setting up your target — add your weight in Profile so we can calculate it."}
                  </Text>
                </>
              )}
            </Card>
          </Pressable>

          <View style={styles.section}>
            <SectionHeader label="HYDRATION" />
            <HydrationCard date={selectedDate} />
          </View>

          {recentFoods && recentFoods.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader label="QUICK ADD" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
                {recentFoods.slice(0, 10).map((f) => (
                  <Pressable key={f.id} onPress={() => handleQuickAdd(f)} style={styles.quickAddChip}>
                    <Text style={styles.quickAddChipText}>{f.name}</Text>
                    <Text style={styles.quickAddChipSub}>{f.calories} kcal</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              label="DIARY"
              action={{ label: "+ Add food", onPress: () => router.push({ pathname: "/log-food", params: { date: selectedDate } }) }}
            />

            {MEAL_TYPE_OPTIONS.map((meal) => {
              const mealEntries = (diary?.entries ?? []).filter((e) => e.mealType === meal.value);
              const mealCals = mealEntries.reduce((s, e) => s + e.calories, 0);
              return (
                <Card key={meal.value} style={styles.mealCard}>
                  <Pressable
                    onPress={() => router.push({ pathname: "/log-food", params: { date: selectedDate, mealType: meal.value } })}
                    style={styles.mealHeader}
                  >
                    <Text style={styles.mealTitle}>{meal.label}</Text>
                    <View style={styles.mealHeaderRight}>
                      {mealCals > 0 ? <Text style={styles.mealCals}>{mealCals} kcal</Text> : null}
                      <Ionicons name="add-circle-outline" size={18} color={Color.gold} />
                    </View>
                  </Pressable>
                  {mealEntries.length === 0 ? (
                    <Pressable onPress={() => router.push({ pathname: "/log-food", params: { date: selectedDate, mealType: meal.value } })}>
                      <Text style={styles.mealEmpty}>{MEAL_EMPTY_COPY[meal.value]}</Text>
                    </Pressable>
                  ) : (
                    mealEntries.map((e) => (
                      <View key={e.id} style={styles.entryRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.entryName}>{e.name}</Text>
                          <Text style={styles.entryMacros}>
                            {e.calories} kcal · P{e.proteinG} C{e.carbsG} F{e.fatG}
                          </Text>
                        </View>
                        <Pressable onPress={() => deleteEntry.mutate({ id: e.id, date: selectedDate })} hitSlop={8}>
                          <Ionicons name="close-circle-outline" size={18} color={Color.textFaint} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </Card>
              );
            })}
          </View>

          <View style={styles.section}>
            <SectionHeader label="MORE TOOLS" />
            <Card tier="quiet">
              <Pressable onPress={() => router.push("/drink-calculator")} style={styles.moreRow}>
                <View style={styles.drinkCardIcon}>
                  <Ionicons name="water-outline" size={18} color={Color.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drinkCardTitle}>Sports Drink Calculator</Text>
                  <Text style={styles.drinkCardSub}>Sport, sweat rate, and conditions — tailored to you</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
              </Pressable>
              <Pressable onPress={() => router.push("/weekly-training")} style={[styles.moreRow, styles.moreRowDivider]}>
                <View style={styles.drinkCardIcon}>
                  <Ionicons name="calendar-outline" size={18} color={Color.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drinkCardTitle}>Weekly Training</Text>
                  <Text style={styles.drinkCardSub}>Your typical week — gym, sport, anything else</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
              </Pressable>
              <Pressable onPress={() => router.push("/meal-suggest")} style={[styles.moreRow, styles.moreRowDivider]}>
                <View style={styles.drinkCardIcon}>
                  <Ionicons name="camera-outline" size={18} color={Color.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drinkCardTitle}>What Can I Make?</Text>
                  <Text style={styles.drinkCardSub}>Photo or list your ingredients for meal ideas</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
              </Pressable>
              <Pressable onPress={() => router.push("/shopping-list")} style={[styles.moreRow, styles.moreRowDivider]}>
                <View style={styles.drinkCardIcon}>
                  <Ionicons name="cart-outline" size={18} color={Color.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drinkCardTitle}>Shopping List</Text>
                  <Text style={styles.drinkCardSub}>Your list, plus ingredients from saved recipes</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
              </Pressable>
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHeader label="WEIGHT CHECK-IN" />
            <BodyWeightCard compact />
          </View>

          <View style={styles.section}>
            <SectionHeader label={"TODAY'S EMPHASIS"} />
            <Card style={styles.emphasisCard}>
              <EmphasisRow icon="water-outline" tone="neutral" title="Hydration" text={hydrationLine} />
              <View style={styles.emphasisDivider} />
              <EmphasisRow icon="flash-outline" tone="gold" title="Training fuel" text={trainingLine} />
              <View style={styles.emphasisDivider} />
              <EmphasisRow
                icon="heart-outline"
                tone="success"
                title="Micros & recovery"
                text="Spread protein across 3–4 meals, get colour on every plate for micronutrients, and keep the last big meal 2–3 hours before sleep. Repair happens between sessions, not during them."
              />
            </Card>
          </View>

          <View style={styles.section}>
            <CoachChat
              configured={data.aiNutritionCoachConfigured}
              initialMessages={data.initialAiNutritionMessages}
              onFocusInput={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <InfoModal
        visible={macroInfo !== null}
        onClose={() => setMacroInfo(null)}
        title={macroInfo ? MACRO_INFO[macroInfo].title : ""}
        body={macroInfo ? MACRO_INFO[macroInfo].body : ""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.md },
  heading: { fontSize: 24, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  dateNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.lg, marginBottom: Spacing.md },
  dateArrow: { padding: 4 },
  dateLabel: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, minWidth: 100, textAlign: "center" },
  targetCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  targetHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.xs },
  fuelDayLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: Color.gold },
  viewWeekRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewWeekText: { fontSize: 11, fontWeight: "600", color: Color.textFaint },
  calorieRow: { flexDirection: "row", alignItems: "baseline" },
  calorieValue: { fontSize: 28, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  calorieTarget: { fontSize: 14, color: Color.textMuted },
  calorieRemaining: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  noTargetText: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.xs },
  macroBlock: { flexDirection: "row", alignItems: "center", gap: Spacing.lg, marginTop: Spacing.md },
  macroLegend: { flex: 1 },
  section: { marginBottom: Spacing.xl },
  quickAddChip: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    minWidth: 100,
  },
  quickAddChipText: { fontSize: 12, fontWeight: "600", color: Color.textPrimary },
  quickAddChipSub: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  mealCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  mealHeaderRight: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  mealCals: { fontSize: 11, color: Color.textMuted },
  mealEmpty: { fontSize: 11, color: Color.textFaint, marginTop: Spacing.xs },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  entryName: { fontSize: 13, fontWeight: "500", color: Color.textPrimary },
  entryMacros: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  hydrationCard: { padding: Spacing.md },
  hydrationLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  hydrationLabel: { fontSize: 11, fontWeight: "600", color: Color.textMuted, letterSpacing: 0.2 },
  hydrationInfoButton: { padding: 1 },
  hydrationMetricValue: {
    fontSize: 26,
    fontWeight: "700",
    color: Color.textPrimary,
    fontVariant: ["tabular-nums"],
    marginBottom: Spacing.sm,
  },
  hydrationMetricTarget: { fontSize: 15, fontWeight: "500", color: Color.textMuted },
  hydrationEmptyText: { fontSize: 11, color: Color.textMuted, lineHeight: 16 },
  hydrationBodyRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  hydrationSideCol: { flex: 1 },
  hydrationSideText: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, lineHeight: 18 },
  bottleWrap: { width: 64, alignItems: "center" },
  bottleCap: {
    width: 24,
    height: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: Color.textFaint,
  },
  bottleNeck: {
    width: 28,
    height: 14,
    backgroundColor: Color.surface2,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Color.borderSubtle,
  },
  bottleBody: {
    width: 64,
    height: 136,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  bottleFill: { width: "100%", backgroundColor: Color.accentData },
  // Decorative glass-sheen highlight — purely visual, not tied to hydration
  // data, so it's fine as a static overlay rather than anything animated.
  bottleSheen: { position: "absolute", top: 0, left: 0, bottom: 0, width: "45%" },
  hydrationQuickAddRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.lg },
  hydrationChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingVertical: 10,
  },
  // The recommended +500ml action — gold-accented like the rest of the
  // app's primary/interactive elements, so the accent stays on something
  // actionable rather than spent on a passive metric.
  hydrationChipPrimary: { borderColor: Color.goldBorder, backgroundColor: Color.goldWeak },
  hydrationChipText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  hydrationChipTextPrimary: { color: Color.gold, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  hydrationManualDivider: { height: 1, backgroundColor: Color.borderSubtle, marginTop: Spacing.md },
  hydrationManualLabel: { fontSize: 11, color: Color.textFaint, marginTop: Spacing.sm, marginBottom: 4 },
  hydrationManualRow: { flexDirection: "row", gap: Spacing.xs },
  hydrationManualInput: {
    flex: 1,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 12,
    color: Color.textPrimary,
  },
  hydrationManualButton: {
    justifyContent: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.md,
  },
  hydrationManualButtonDisabled: { opacity: 0.5 },
  hydrationManualButtonText: { fontSize: 12, fontWeight: "700", color: Color.gold },
  hydrationManualError: { fontSize: 11, color: Color.danger, marginTop: 6 },
  moreRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md },
  moreRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  drinkCardIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  drinkCardTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  drinkCardSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  chatCard: { padding: Spacing.md },
  chatTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.sm },
  chatUnavailable: { fontSize: 12, color: Color.textMuted },
  chatMessages: { minHeight: 60, marginBottom: Spacing.sm },
  chatEmpty: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  bubble: { borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs, maxWidth: "85%" },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Color.goldWeak },
  bubbleAssistant: { alignSelf: "flex-start", backgroundColor: Color.surface2 },
  bubbleUserText: { fontSize: 13, color: Color.gold },
  bubbleAssistantText: { fontSize: 13, color: Color.textSecondary },
  error: { fontSize: 11, color: Color.danger, marginBottom: Spacing.xs },
  chatInputRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-end" },
  chatInput: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    color: Color.textPrimary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    maxHeight: 100,
  },
  sendButton: { backgroundColor: Color.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  sendButtonText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
  emphasisCard: { padding: 0 },
  emphasisRow: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md },
  emphasisDivider: { height: 1, backgroundColor: Color.borderSubtle, marginHorizontal: Spacing.md },
  emphasisIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emphasisTitle: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
  emphasisText: { fontSize: 12, color: Color.textMuted, marginTop: 4, lineHeight: 17 },
});
