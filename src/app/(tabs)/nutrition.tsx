import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WeightTrendChart } from "@/components/ui/WeightTrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { tapFeedback } from "@/lib/haptics";
import { useBodyWeightLogs, useLogBodyWeight } from "@/lib/queries/body-weight";
import {
  MEAL_TYPE_OPTIONS,
  useCreateFoodEntry,
  useDeleteFoodEntry,
  useMyNutritionTarget,
  useNutritionDiary,
  useRecentFoods,
  type MealType,
} from "@/lib/queries/nutrition-diary";
import { useNutrition, useSendNutritionCoachMessage, type FoodItem, type NutritionAiMessage } from "@/lib/queries/nutrition";
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

function defaultMealTypeForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function MacroBar({ label, consumed, target }: { label: string; consumed: number; target: number | null }) {
  const pct = target && target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroLabelRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {consumed}
          {target ? `/${target}g` : "g"}
        </Text>
      </View>
      {target ? (
        <View style={styles.macroTrack}>
          <View style={[styles.macroFill, { width: `${pct}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

function FoodChip({ item }: { item: FoodItem }) {
  return (
    <View style={styles.foodChip}>
      <Text style={styles.foodChipText}>{item.name}</Text>
    </View>
  );
}

function CoachChat({ configured, initialMessages }: { configured: boolean; initialMessages: NutritionAiMessage[] }) {
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
        <TextInput value={input} onChangeText={setInput} placeholder="Ask the coach…" placeholderTextColor={Color.textFaint} style={styles.chatInput} multiline onSubmitEditing={handleSend} />
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

  const { data, isLoading, isError, refetch, isRefetching } = useNutrition();
  const { data: target } = useMyNutritionTarget();
  const { data: diary } = useNutritionDiary(selectedDate);
  const { data: recentFoods } = useRecentFoods();
  const createEntry = useCreateFoodEntry();
  const deleteEntry = useDeleteFoodEntry();

  const { data: weightLogs } = useBodyWeightLogs();
  const logWeight = useLogBodyWeight();
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const latestWeight = useMemo(() => (weightLogs && weightLogs.length > 0 ? [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0] : null), [weightLogs]);

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

  async function handleSaveWeight() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg <= 0) return;
    await logWeight.mutateAsync({ date: today, weightKg: kg });
    tapFeedback();
    setWeightInput("");
    setLoggingWeight(false);
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

  const allFoods = [...data.foodRecommendations.protein, ...data.foodRecommendations.carb, ...data.foodRecommendations.snack];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
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

          <Card style={styles.targetCard}>
            {target ? (
              <>
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
                  <MacroBar label="Protein" consumed={diary?.totals.proteinG ?? 0} target={target.proteinG} />
                  <MacroBar label="Carbs" consumed={diary?.totals.carbsG ?? 0} target={target.carbsG} />
                  <MacroBar label="Fat" consumed={diary?.totals.fatG ?? 0} target={target.fatG} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.calorieRow}>
                  <Text style={styles.calorieValue}>{diary?.totals.calories ?? 0}</Text>
                  <Text style={styles.calorieTarget}> kcal logged</Text>
                </View>
                <Text style={styles.noTargetText}>Your coach hasn&apos;t set a target yet — logging still works.</Text>
              </>
            )}
          </Card>

          {recentFoods && recentFoods.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>QUICK ADD</Text>
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>DIARY</Text>
              <Pressable onPress={() => router.push({ pathname: "/log-food", params: { date: selectedDate } })}>
                <Text style={styles.addFoodText}>+ Add food</Text>
              </Pressable>
            </View>

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
                    <Text style={styles.mealEmpty}>Nothing logged.</Text>
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
            <Text style={styles.sectionLabel}>WEIGHT CHECK-IN</Text>
            <Card style={styles.weightCard}>
              <View style={styles.weightHeaderRow}>
                <View>
                  <Text style={styles.weightValue}>{latestWeight ? `${latestWeight.weightKg} kg` : "—"}</Text>
                  <Text style={styles.weightSub}>{latestWeight ? `Last logged ${latestWeight.date}` : "No check-ins yet"}</Text>
                </View>
                {!loggingWeight ? (
                  <Button title="Log weight" variant="secondary" onPress={() => setLoggingWeight(true)} />
                ) : null}
              </View>
              {loggingWeight ? (
                <View style={styles.weightInputRow}>
                  <TextInput
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor={Color.textFaint}
                    style={styles.weightInput}
                    autoFocus
                  />
                  <Button title="Save" onPress={handleSaveWeight} loading={logWeight.isPending} style={{ flex: 1 }} />
                </View>
              ) : null}
              {weightLogs && weightLogs.length >= 2 ? (
                <View style={{ marginTop: Spacing.md }}>
                  <WeightTrendChart logs={weightLogs} />
                </View>
              ) : null}
            </Card>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MORE</Text>
            <Pressable onPress={() => router.push("/drink-calculator")}>
              <Card style={styles.drinkCard}>
                <View style={styles.drinkCardIcon}>
                  <Ionicons name="water-outline" size={18} color={Color.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drinkCardTitle}>Sports Drink Calculator</Text>
                  <Text style={styles.drinkCardSub}>Sport, sweat rate, and conditions — tailored to you</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
              </Card>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FOOD IDEAS</Text>
            <View style={styles.foodGrid}>
              {allFoods.slice(0, 18).map((f) => (
                <FoodChip key={f.name} item={f} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <CoachChat configured={data.aiNutritionCoachConfigured} initialMessages={data.initialAiNutritionMessages} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  calorieRow: { flexDirection: "row", alignItems: "baseline" },
  calorieValue: { fontSize: 28, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  calorieTarget: { fontSize: 14, color: Color.textMuted },
  calorieRemaining: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  noTargetText: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.xs },
  macroBlock: { marginTop: Spacing.md, gap: Spacing.sm },
  macroRow: {},
  macroLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  macroLabel: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  macroValue: { fontSize: 11, color: Color.textMuted, fontVariant: ["tabular-nums"] },
  macroTrack: { height: 6, borderRadius: 3, backgroundColor: Color.surface2, overflow: "hidden" },
  macroFill: { height: "100%", backgroundColor: Color.gold, borderRadius: 3 },
  section: { marginBottom: Spacing.xl },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  addFoodText: { fontSize: 12, fontWeight: "600", color: Color.gold, marginBottom: Spacing.sm },
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
  weightCard: { padding: Spacing.md },
  weightHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weightValue: { fontSize: 20, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  weightSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  weightInputRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  weightInput: {
    width: 90,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Color.textPrimary,
  },
  drinkCard: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md },
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
  foodGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  foodChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  foodChipText: { fontSize: 11, color: Color.textSecondary },
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
});
