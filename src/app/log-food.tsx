import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
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

export default function LogFoodScreen() {
  const router = useRouter();
  const { date: dateParam, mealType: mealTypeParam } = useLocalSearchParams<{ date?: string; mealType?: string }>();
  const { data: recentFoods } = useRecentFoods();
  const createEntry = useCreateFoodEntry();

  const date = dateParam ?? todayDateString();
  const [mealType, setMealType] = useState<MealType>((mealTypeParam as MealType) ?? defaultMealTypeForNow());
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [error, setError] = useState<string | null>(null);

  function applyRecent(f: NonNullable<typeof recentFoods>[number]) {
    tapFeedback();
    setName(f.name);
    setCalories(String(f.calories));
    setProteinG(String(f.proteinG));
    setCarbsG(String(f.carbsG));
    setFatG(String(f.fatG));
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

    try {
      await createEntry.mutateAsync({
        date,
        mealType,
        name: name.trim(),
        calories: cals,
        proteinG: proteinG.trim() ? parseInt(proteinG, 10) : 0,
        carbsG: carbsG.trim() ? parseInt(carbsG, 10) : 0,
        fatG: fatG.trim() ? parseInt(fatG, 10) : 0,
      });
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not log this food. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Log Food</Text>
          <View style={{ width: 22 }} />
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

          {recentFoods && recentFoods.length > 0 ? (
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

          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Food name</Text>
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
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mealChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  mealChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  mealChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  mealChipTextActive: { color: Color.gold },
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
});
