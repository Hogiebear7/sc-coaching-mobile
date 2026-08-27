import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { tapFeedback } from "@/lib/haptics";
import { useDescribeFoodText, type IdentifiedFoodItem } from "@/lib/queries/food-catalog";
import { useCreateFoodEntry, type MealType } from "@/lib/queries/nutrition-diary";
import { todayDateString } from "@/lib/workout-formatters";

type Stage = "input" | "interpreting" | "reviewing";

interface ReviewItem extends IdentifiedFoodItem {
  id: string;
  included: boolean;
}

function defaultMealTypeForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

// A typing-first sibling to label-scan.tsx — same review-before-save UX
// (editable cards, one AI call, nothing saved until the member confirms),
// just entered by describing the food instead of photographing it.
export default function DescribeFoodScreen() {
  const router = useRouter();
  const { date, mealType } = useLocalSearchParams<{ date?: string; mealType?: string }>();
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const describeFood = useDescribeFoodText();
  const createEntry = useCreateFoodEntry();

  const effectiveDate = date || todayDateString();
  const effectiveMealType = (mealType as MealType) || defaultMealTypeForNow();

  async function handleInterpret() {
    if (!text.trim() || stage === "interpreting") return;
    tapFeedback();
    setDescribeError(null);
    setStage("interpreting");

    try {
      const res = await describeFood.mutateAsync({ descriptionText: text.trim() });
      if (res.items.length === 0) {
        trackEvent("describe_food_nothing_identified", {});
        setDescribeError("Couldn't work out a food from that — try describing it differently, e.g. \"a bowl of porridge with a banana\".");
        setStage("input");
        return;
      }
      trackEvent("describe_food_items_identified", { count: res.items.length });
      setItems(res.items.map((item, i) => ({ ...item, id: `item-${i}`, included: true })));
      setStage("reviewing");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection and try again.";
      trackEvent("describe_food_failed", { reason: e instanceof Error ? e.message : "unknown" });
      setDescribeError(message);
      setStage("input");
    }
  }

  function updateItem(id: string, patch: Partial<Pick<ReviewItem, "name" | "calories" | "proteinG" | "carbsG" | "fatG">>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function toggleItem(id: string) {
    tapFeedback();
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, included: !it.included } : it)));
  }

  function removeItem(id: string) {
    tapFeedback();
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleLogIncluded() {
    const included = items.filter((it) => it.included);
    if (included.length === 0) return;
    setError(null);
    setLogging(true);
    try {
      for (const item of included) {
        await createEntry.mutateAsync({
          date: effectiveDate,
          mealType: effectiveMealType,
          name: item.name,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          foodId: null,
          foodDomain: null,
          servingLabel: null,
          servingGrams: null,
          quantity: null,
        });
      }
      tapFeedback();
      router.back();
    } catch (e) {
      setLogging(false);
      setError(e instanceof ApiError ? e.message : "Could not log this food. Please try again.");
    }
  }

  if (stage === "interpreting") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="sparkles" size={26} color={Color.goldForeground} />
          </View>
          <Text style={styles.confirmTitle}>Reading that…</Text>
          <Text style={styles.confirmText}>Working out what you ate and estimating the nutrition.</Text>
          <ActivityIndicator color={Color.gold} size="small" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === "reviewing") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => setStage("input")} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Review & Log</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subhead}>
            {items.length === 1 ? "Here's what we found — check it over before logging." : `We found ${items.length} items — check them over before logging.`}
          </Text>

          {items.map((item) => (
            <Card key={item.id} style={[styles.itemCard, !item.included && styles.itemCardExcluded]}>
              <View style={styles.itemHeaderRow}>
                <Pressable onPress={() => toggleItem(item.id)} hitSlop={8} style={styles.checkbox}>
                  <Ionicons
                    name={item.included ? "checkbox" : "square-outline"}
                    size={20}
                    color={item.included ? Color.gold : Color.textFaint}
                  />
                </Pressable>
                <TextInput
                  value={item.name}
                  onChangeText={(v) => updateItem(item.id, { name: v })}
                  style={styles.nameInput}
                  placeholderTextColor={Color.textFaint}
                />
                <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Color.textFaint} />
                </Pressable>
              </View>

              <Text style={styles.servingText}>{item.servingDescription || "Serving not specified"}</Text>

              <View style={styles.gridRow}>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Calories</Text>
                  <TextInput
                    value={String(item.calories)}
                    onChangeText={(v) => updateItem(item.id, { calories: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Protein (g)</Text>
                  <TextInput
                    value={String(item.proteinG)}
                    onChangeText={(v) => updateItem(item.id, { proteinG: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Carbs (g)</Text>
                  <TextInput
                    value={String(item.carbsG)}
                    onChangeText={(v) => updateItem(item.id, { carbsG: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Fat (g)</Text>
                  <TextInput
                    value={String(item.fatG)}
                    onChangeText={(v) => updateItem(item.id, { fatG: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>
            </Card>
          ))}

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Everything was removed. Describe it again or enter it manually.</Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={items.filter((i) => i.included).length > 1 ? `Log ${items.filter((i) => i.included).length} items` : "Log this food"}
            onPress={handleLogIncluded}
            loading={logging}
            disabled={items.filter((i) => i.included).length === 0}
            style={{ marginTop: Spacing.lg }}
          />
          <Pressable onPress={() => setStage("input")} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>Describe it again</Text>
          </Pressable>
          <Pressable onPress={() => router.replace({ pathname: "/custom-food", params: { date: effectiveDate, mealType: effectiveMealType } })} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>Enter a food manually instead</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Describe It</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.inputWrap}>
        <Text style={styles.confirmText}>Type what you ate — a couple of items is fine, e.g. &quot;two eggs and a slice of toast&quot;.</Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="e.g. a bowl of porridge with a banana"
          placeholderTextColor={Color.textFaint}
          style={styles.descriptionInput}
          multiline
          autoFocus
        />

        {describeError ? <Text style={styles.error}>{describeError}</Text> : null}

        <Button title="Work it out" onPress={handleInterpret} disabled={!text.trim()} style={{ marginTop: Spacing.lg }} />
      </View>

      <Pressable onPress={() => router.replace({ pathname: "/custom-food", params: { date: effectiveDate, mealType: effectiveMealType } })} style={styles.manualLink}>
        <Text style={styles.manualLinkText}>Enter this food manually instead</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  subhead: { fontSize: 12, color: Color.textMuted, textAlign: "center", paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  confirmIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.md },
  confirmText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  inputWrap: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  descriptionInput: {
    marginTop: Spacing.lg,
    minHeight: 100,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Color.textPrimary,
    textAlignVertical: "top",
  },
  manualLink: { alignItems: "center", paddingVertical: Spacing.lg },
  manualLinkText: { fontSize: 13, color: Color.gold, fontWeight: "600" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  itemCard: { padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  itemCardExcluded: { opacity: 0.5 },
  itemHeaderRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  checkbox: { padding: 2 },
  nameInput: { flex: 1, fontSize: 14, fontWeight: "700", color: Color.textPrimary, paddingVertical: 4 },
  servingText: { fontSize: 12, color: Color.textMuted },
  gridRow: { flexDirection: "row", gap: Spacing.sm },
  numberField: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "500", color: Color.textSecondary, marginBottom: 4 },
  input: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xl },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm, textAlign: "center" },
});
