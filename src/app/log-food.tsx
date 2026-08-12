import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import {
  gramsForServing,
  nutritionForGrams,
  useFoodSearch,
  useReportMissingFood,
  type FoodDomain,
  type FoodRecord,
} from "@/lib/queries/food-catalog";
import { tapFeedback } from "@/lib/haptics";
import { MEAL_TYPE_OPTIONS, useCreateFoodEntry, useRecentFoods, type MealType } from "@/lib/queries/nutrition-diary";
import { todayDateString } from "@/lib/workout-formatters";

function defaultMealTypeForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

const SEARCH_GROUPS: { key: keyof import("@/lib/queries/food-catalog").FoodSearchGroups; label: string }[] = [
  { key: "history", label: "History" },
  { key: "custom", label: "Custom" },
  { key: "common", label: "Common" },
  { key: "branded", label: "Branded" },
];

function FoodResultRow({ food, onPress }: { food: FoodRecord; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.resultRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultName} numberOfLines={1}>
          {food.brandName ? `${food.brandName} — ${food.name}` : food.name}
        </Text>
        <Text style={styles.resultSub}>
          {food.nutrition100g.calories} kcal / 100g
          {food.domain === "branded" && !food.verified ? " · unverified" : ""}
        </Text>
      </View>
      <Ionicons name="add-circle-outline" size={20} color={Color.gold} />
    </Pressable>
  );
}

export default function LogFoodScreen() {
  const router = useRouter();
  const { date: dateParam, mealType: mealTypeParam, foodJson } = useLocalSearchParams<{ date?: string; mealType?: string; foodJson?: string }>();
  const { data: recentFoods } = useRecentFoods();
  const createEntry = useCreateFoodEntry();
  const reportMissing = useReportMissingFood();

  const date = dateParam ?? todayDateString();
  const [mealType, setMealType] = useState<MealType>((mealTypeParam as MealType) ?? defaultMealTypeForNow());

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  const trackedSearchRef = useRef(false);
  useEffect(() => {
    if (debouncedQuery.trim() && !trackedSearchRef.current) {
      trackedSearchRef.current = true;
      trackEvent("food_search_started");
    }
    if (!debouncedQuery.trim()) trackedSearchRef.current = false;
  }, [debouncedQuery]);
  const { data: searchGroups, isFetching: isSearching } = useFoodSearch(debouncedQuery);
  const [searchOpen, setSearchOpen] = useState(false);

  const [selectedFood, setSelectedFood] = useState<{ food: FoodRecord; domain: FoodDomain } | null>(null);
  const [servingLabel, setServingLabel] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [foundViaScan, setFoundViaScan] = useState(false);

  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState(false);

  function applyRecent(f: NonNullable<typeof recentFoods>[number]) {
    tapFeedback();
    setSelectedFood(null);
    setName(f.name);
    setCalories(String(f.calories));
    setProteinG(String(f.proteinG));
    setCarbsG(String(f.carbsG));
    setFatG(String(f.fatG));
  }

  function selectSearchResult(food: FoodRecord, source: "search" | "scan" = "search") {
    tapFeedback();
    if (source === "search") trackEvent("food_search_result_selected", { domain: food.domain });
    setSelectedFood({ food, domain: food.domain });
    setServingLabel(food.defaultServing.label);
    setQuantity(1);
    setFoundViaScan(source === "scan");
    setName(food.brandName ? `${food.brandName} ${food.name}` : food.name);
    setSearchOpen(false);
    setQuery("");
  }

  // A food handed back from barcode-scan or custom-food (create/edit) arrives
  // as a JSON param rather than a live search result — apply it the same way,
  // flagged as "scan" so the serving card can confirm the match explicitly
  // (the member didn't just tap a result they were already looking at).
  const consumedFoodJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!foodJson || consumedFoodJsonRef.current === foodJson) return;
    consumedFoodJsonRef.current = foodJson;
    try {
      const food = JSON.parse(decodeURIComponent(foodJson)) as FoodRecord;
      selectSearchResult(food, "scan");
    } catch {
      // Malformed param — ignore rather than crash the screen.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodJson]);

  function handleReportMissing() {
    if (reportMissing.isPending || reportMissing.isSuccess) return;
    tapFeedback();
    reportMissing.mutate({ queryText: query.trim() });
  }

  // Recompute the macro fields whenever the selected food, serving, or
  // quantity changes — keeps the preview live as the member adjusts either.
  useEffect(() => {
    if (!selectedFood) return;
    if (!Number.isFinite(quantity) || quantity < 0) return;
    const grams = gramsForServing(selectedFood.food, servingLabel, quantity);
    const nutrition = nutritionForGrams(selectedFood.food.nutrition100g, grams);
    setCalories(String(nutrition.calories));
    setProteinG(String(nutrition.proteinG));
    setCarbsG(String(nutrition.carbsG));
    setFatG(String(nutrition.fatG));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFood, servingLabel, quantity]);

  function clearSelection() {
    setSelectedFood(null);
    setServingLabel(null);
    setQuantity(1);
    setFoundViaScan(false);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Food name is required.");
      return;
    }
    const cals = parseInt(calories, 10);
    if (!Number.isFinite(cals) || cals < 0) {
      setError("Calories must be a non-negative number.");
      return;
    }

    const qty = selectedFood ? quantity : null;

    try {
      await createEntry.mutateAsync({
        date,
        mealType,
        name: name.trim(),
        calories: cals,
        proteinG: proteinG.trim() ? parseInt(proteinG, 10) : 0,
        carbsG: carbsG.trim() ? parseInt(carbsG, 10) : 0,
        fatG: fatG.trim() ? parseInt(fatG, 10) : 0,
        foodId: selectedFood?.food.id ?? null,
        foodDomain: selectedFood?.domain ?? null,
        servingLabel: selectedFood ? servingLabel : null,
        servingGrams: selectedFood ? gramsForServing(selectedFood.food, servingLabel, 1) : null,
        quantity: qty,
      });
      tapFeedback();
      setJustLogged(true);
      setTimeout(() => router.back(), 550);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not log this food. Please try again.");
    }
  }

  const hasResults = !!searchGroups && SEARCH_GROUPS.some((g) => searchGroups[g.key].length > 0);
  const mealLabel = MEAL_TYPE_OPTIONS.find((o) => o.value === mealType)?.label ?? mealType;

  if (justLogged) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.confirmFill}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="checkmark" size={30} color={Color.goldForeground} />
          </View>
          <Text style={styles.confirmTitle}>Logged to {mealLabel}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Log Food</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push({ pathname: "/label-scan", params: { date, mealType } })}
              hitSlop={12}
            >
              <Ionicons name="camera-outline" size={22} color={Color.gold} />
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/barcode-scan", params: { date, mealType } })}
              hitSlop={12}
            >
              <Ionicons name="barcode-outline" size={22} color={Color.gold} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Meal</Text>
          <View style={styles.mealRow}>
            {MEAL_TYPE_OPTIONS.map((opt) => (
              <Pressable key={opt.value} onPress={() => setMealType(opt.value)} style={[styles.mealChip, mealType === opt.value && styles.mealChipActive]}>
                <Text style={[styles.mealChipText, mealType === opt.value && styles.mealChipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Search foods</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={Color.textFaint} />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search your foods, common foods, brands…"
              placeholderTextColor={Color.textFaint}
              style={styles.searchInput}
              autoCapitalize="none"
            />
            {isSearching ? <ActivityIndicator size="small" color={Color.textFaint} /> : null}
          </View>

          <View style={styles.quickLinksRow}>
            <Pressable onPress={() => router.push({ pathname: "/custom-food", params: { date, mealType } })} style={styles.quickLink}>
              <Ionicons name="add-circle-outline" size={14} color={Color.gold} />
              <Text style={styles.quickLinkText}>Add custom food</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/my-foods")} style={styles.quickLink}>
              <Ionicons name="list-outline" size={14} color={Color.textMuted} />
              <Text style={[styles.quickLinkText, { color: Color.textMuted }]}>Manage custom foods</Text>
            </Pressable>
          </View>

          {searchOpen ? (
            <Card style={styles.resultsCard}>
              {!hasResults ? (
                <>
                  <Text style={styles.noResultsText}>{query.trim() ? "No matches. Try scanning a barcode or add it manually below." : "Type to search, or browse your recent history."}</Text>
                  {query.trim() ? (
                    <Pressable onPress={handleReportMissing} style={styles.reportMissingLink}>
                      <Text style={styles.reportMissingLinkText}>{reportMissing.isSuccess ? "Reported — thanks!" : "Let us know this food is missing"}</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                SEARCH_GROUPS.map((group) => {
                  const items = searchGroups?.[group.key] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <View key={group.key} style={styles.resultGroup}>
                      <Text style={styles.resultGroupLabel}>{group.label.toUpperCase()}</Text>
                      {items.map((food) => (
                        <FoodResultRow key={food.id} food={food} onPress={() => selectSearchResult(food)} />
                      ))}
                    </View>
                  );
                })
              )}
              <Pressable onPress={() => setSearchOpen(false)} style={styles.closeSearchRow}>
                <Text style={styles.closeSearchText}>Close search</Text>
              </Pressable>
            </Card>
          ) : null}

          {selectedFood ? (
            <Card style={styles.servingCard}>
              {foundViaScan ? (
                <View style={styles.foundBanner}>
                  <Ionicons name="checkmark-circle" size={14} color={Color.success} />
                  <Text style={styles.foundBannerText}>Found it — review the serving below</Text>
                </View>
              ) : null}
              <View style={styles.servingHeaderRow}>
                <Text style={styles.servingFoodName} numberOfLines={1}>
                  {selectedFood.food.name}
                </Text>
                <Pressable onPress={clearSelection} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Color.textFaint} />
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>Serving</Text>
              <View style={styles.mealRow}>
                {selectedFood.food.servings.map((s) => (
                  <Pressable
                    key={s.label}
                    onPress={() => setServingLabel(s.label)}
                    style={[styles.mealChip, servingLabel === s.label && styles.mealChipActive]}
                  >
                    <Text style={[styles.mealChipText, servingLabel === s.label && styles.mealChipTextActive]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Stepper label="Quantity" value={quantity} onChange={setQuantity} min={0.5} max={20} step={0.5} suffix="× serving" />
              <Text style={styles.gramsTotal}>= {Math.round(gramsForServing(selectedFood.food, servingLabel, quantity))}g total</Text>
            </Card>
          ) : recentFoods && recentFoods.length > 0 ? (
            <>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Quick add from recent</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, paddingBottom: Spacing.sm }}>
                {recentFoods.map((f) => (
                  <Pressable key={f.id} onPress={() => applyRecent(f)} style={styles.recentChip}>
                    <Text style={styles.recentChipText}>{f.name}</Text>
                    <Text style={styles.recentChipSub}>{f.calories} kcal</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.sectionLabel}>{selectedFood ? "REVIEW BEFORE LOGGING" : "OR LOG MANUALLY"}</Text>
          <Text style={styles.fieldLabel}>Food name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Chicken and rice" placeholderTextColor={Color.textFaint} style={styles.input} />

          <View style={styles.gridRow}>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Calories</Text>
              <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" placeholder="e.g. 450" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Protein (g)</Text>
              <TextInput value={proteinG} onChangeText={setProteinG} keyboardType="number-pad" placeholder="e.g. 40" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Carbs (g)</Text>
              <TextInput value={carbsG} onChangeText={setCarbsG} keyboardType="number-pad" placeholder="e.g. 50" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Fat (g)</Text>
              <TextInput value={fatG} onChangeText={setFatG} keyboardType="number-pad" placeholder="e.g. 12" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Log food" onPress={handleSave} loading={createEntry.isPending} style={{ marginTop: Spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mealChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  mealChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  mealChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  mealChipTextActive: { color: Color.gold },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  searchInput: { flex: 1, color: Color.textPrimary, fontSize: 14 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  quickLinksRow: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.sm },
  quickLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  quickLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  resultsCard: { marginTop: Spacing.sm, padding: Spacing.md },
  noResultsText: { fontSize: 12, color: Color.textMuted },
  reportMissingLink: { marginTop: Spacing.sm },
  reportMissingLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  resultGroup: { marginBottom: Spacing.sm },
  resultGroupLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: 4 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  resultName: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  resultSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  closeSearchRow: { alignItems: "center", marginTop: Spacing.xs, paddingVertical: 6 },
  closeSearchText: { fontSize: 12, color: Color.textFaint },
  servingCard: { padding: Spacing.md, marginTop: Spacing.md, backgroundColor: Color.surface2 },
  foundBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.sm },
  foundBannerText: { fontSize: 12, fontWeight: "600", color: Color.success },
  servingHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  servingFoodName: { fontSize: 14, fontWeight: "700", color: Color.textPrimary, flex: 1 },
  gramsTotal: { fontSize: 12, color: Color.textMuted, textAlign: "right", marginTop: -Spacing.sm },
  recentChip: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    minWidth: 100,
  },
  recentChipText: { fontSize: 12, fontWeight: "600", color: Color.textPrimary },
  recentChipSub: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Color.textPrimary,
    marginBottom: Spacing.md,
  },
  gridRow: { flexDirection: "row", gap: Spacing.sm },
  numberField: { flex: 1 },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm },
  confirmFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  confirmIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.md },
});
