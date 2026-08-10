import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { setDraftLabelPhoto } from "@/lib/draft-photo-cache";
import { tapFeedback } from "@/lib/haptics";
import {
  nutritionForGrams,
  useCreateCustomFood,
  useDeleteCustomFood,
  useMyCustomFoods,
  useUpdateCustomFood,
  type FoodNutrition100g,
  type FoodRecord,
} from "@/lib/queries/food-catalog";

const PREFILL_BANNER_COPY: Record<string, string> = {
  label_scan_ocr: "We read what we could from the label — please double-check every field before saving.",
  label_scan_fallback: "Photo captured. Automatic reading isn't available yet, so add the details below using the label you just photographed.",
};

// The user naturally knows nutrition "per serving" (what's printed on a
// label), not per 100g. This form collects per-serving values and derives
// the canonical per-100g figures, mirroring lib/food-catalog.ts's
// nutritionForGrams math run in reverse.
function nutrition100gFromServing(
  values: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null; sugarG: number | null; sodiumMg: number | null; saturatedFatG: number | null },
  grams: number
): FoodNutrition100g {
  const factor = grams > 0 ? 100 / grams : 0;
  const scale = (v: number | null) => (v === null ? null : Math.round(v * factor * 10) / 10);
  return {
    calories: Math.round(values.calories * factor),
    proteinG: scale(values.proteinG) ?? 0,
    carbsG: scale(values.carbsG) ?? 0,
    fatG: scale(values.fatG) ?? 0,
    fiberG: scale(values.fiberG),
    sugarG: scale(values.sugarG),
    sodiumMg: values.sodiumMg === null ? null : Math.round(values.sodiumMg * factor),
    saturatedFatG: scale(values.saturatedFatG),
  };
}

export default function CustomFoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    barcode?: string;
    name?: string;
    brandName?: string;
    calories?: string;
    proteinG?: string;
    carbsG?: string;
    fatG?: string;
    fiberG?: string;
    sugarG?: string;
    sodiumMg?: string;
    saturatedFatG?: string;
    servingLabel?: string;
    servingGrams?: string;
    date?: string;
    mealType?: string;
    prefillSource?: string;
    capturedLabelPhoto?: string;
  }>();
  const isEditing = !!params.id;
  const { data: myFoods } = useMyCustomFoods();
  const editingFood: FoodRecord | undefined = isEditing ? myFoods?.find((f) => f.id === params.id) : undefined;

  const createFood = useCreateCustomFood();
  const updateFood = useUpdateCustomFood();
  const deleteFood = useDeleteCustomFood();

  const [name, setName] = useState(params.name ?? "");
  const [brandName, setBrandName] = useState(params.brandName ?? "");
  const [barcode, setBarcode] = useState(params.barcode ?? "");
  const [servingLabel, setServingLabel] = useState(params.servingLabel ?? "1 serving");
  const [servingGrams, setServingGrams] = useState(params.servingGrams ?? "");
  const [calories, setCalories] = useState(params.calories ?? "");
  const [proteinG, setProteinG] = useState(params.proteinG ?? "");
  const [carbsG, setCarbsG] = useState(params.carbsG ?? "");
  const [fatG, setFatG] = useState(params.fatG ?? "");
  const [fiberG, setFiberG] = useState(params.fiberG ?? "");
  const [sugarG, setSugarG] = useState(params.sugarG ?? "");
  const [sodiumMg, setSodiumMg] = useState(params.sodiumMg ?? "");
  const [saturatedFatG, setSaturatedFatG] = useState(params.saturatedFatG ?? "");
  const [hydratedFromExisting, setHydratedFromExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode: reverse the stored per-100g figures back into "per serving"
  // for the form, using the food's own default serving as the reference.
  useEffect(() => {
    if (hydratedFromExisting || !editingFood) return;
    const grams = editingFood.defaultServing.grams;
    const perServing = nutritionForGrams(editingFood.nutrition100g, grams);
    setName(editingFood.name);
    setBrandName(editingFood.brandName ?? "");
    setBarcode(editingFood.barcode ?? "");
    setServingLabel(editingFood.defaultServing.label);
    setServingGrams(String(grams));
    setCalories(String(perServing.calories));
    setProteinG(String(perServing.proteinG));
    setCarbsG(String(perServing.carbsG));
    setFatG(String(perServing.fatG));
    setFiberG(perServing.fiberG === null ? "" : String(perServing.fiberG));
    setSugarG(perServing.sugarG === null ? "" : String(perServing.sugarG));
    setSodiumMg(perServing.sodiumMg === null ? "" : String(perServing.sodiumMg));
    setSaturatedFatG(perServing.saturatedFatG === null ? "" : String(perServing.saturatedFatG));
    setHydratedFromExisting(true);
  }, [editingFood, hydratedFromExisting]);

  function optionalNumber(v: string): number | null {
    if (!v.trim()) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Food name is required.");
      return;
    }
    const grams = parseFloat(servingGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      setError("Serving size (grams) must be a positive number.");
      return;
    }
    const cals = parseFloat(calories);
    const protein = parseFloat(proteinG);
    const carbs = parseFloat(carbsG);
    const fat = parseFloat(fatG);
    if ([cals, protein, carbs, fat].some((n) => !Number.isFinite(n) || n < 0)) {
      setError("Calories, protein, carbs, and fat must be non-negative numbers.");
      return;
    }

    const nutrition100g = nutrition100gFromServing(
      { calories: cals, proteinG: protein, carbsG: carbs, fatG: fat, fiberG: optionalNumber(fiberG), sugarG: optionalNumber(sugarG), sodiumMg: optionalNumber(sodiumMg), saturatedFatG: optionalNumber(saturatedFatG) },
      grams
    );

    const userServing = { label: servingLabel.trim() || "1 serving", grams };
    const servings = grams === 100 ? [userServing] : [userServing, { label: "100g", grams: 100 }];

    try {
      let saved: FoodRecord;
      if (isEditing && params.id) {
        const res = await updateFood.mutateAsync({
          id: params.id,
          name: name.trim(),
          brandName: brandName.trim() || undefined,
          barcode: barcode.trim() || undefined,
          nutrition100g,
          servings,
        });
        saved = res.data;
      } else {
        const res = await createFood.mutateAsync({
          name: name.trim(),
          brandName: brandName.trim() || undefined,
          barcode: barcode.trim() || undefined,
          nutrition100g,
          servings,
        });
        saved = res.data;
        trackEvent("custom_food_created", { hasBarcode: !!saved.barcode, prefillSource: params.prefillSource ?? "manual" });
      }
      tapFeedback();

      if (params.capturedLabelPhoto) {
        setDraftLabelPhoto(saved.id, params.capturedLabelPhoto);
      }

      if (params.date && params.mealType) {
        router.replace({ pathname: "/log-food", params: { date: params.date, mealType: params.mealType, foodJson: encodeURIComponent(JSON.stringify(saved)) } });
      } else {
        router.back();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this food. Please try again.");
    }
  }

  function handleDelete() {
    if (!params.id) return;
    Alert.alert("Delete custom food?", `"${name}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFood.mutateAsync(params.id as string);
            tapFeedback();
            router.back();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Could not delete this food.");
          }
        },
      },
    ]);
  }

  const saving = createFood.isPending || updateFood.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? "Edit Custom Food" : "New Custom Food"}</Text>
          {isEditing ? (
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Ionicons name="trash-outline" size={20} color={Color.danger} />
            </Pressable>
          ) : (
            <View style={{ width: 20 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {params.prefillSource && PREFILL_BANNER_COPY[params.prefillSource] ? (
            <View style={styles.hintBanner}>
              <Ionicons name="information-circle-outline" size={16} color={Color.gold} />
              <Text style={styles.hintBannerText}>{PREFILL_BANNER_COPY[params.prefillSource]}</Text>
            </View>
          ) : null}

          {params.capturedLabelPhoto ? (
            <View style={styles.photoChip}>
              <Ionicons name="image" size={14} color={Color.success} />
              <Text style={styles.photoChipText}>Label photo attached — you can reuse it later if you share this food publicly.</Text>
            </View>
          ) : null}

          <TextField label="Food name" value={name} onChangeText={setName} placeholder="e.g. Homemade protein bar" />
          <TextField label="Brand (optional)" value={brandName} onChangeText={setBrandName} placeholder="e.g. Kitchen made" />
          <TextField label="Barcode (optional)" value={barcode} onChangeText={setBarcode} placeholder="e.g. 5901234123457" keyboardType="number-pad" />

          <Text style={styles.sectionLabel}>SERVING</Text>
          <View style={styles.gridRow}>
            <View style={{ flex: 2 }}>
              <TextField label="Serving label" value={servingLabel} onChangeText={setServingLabel} placeholder="e.g. 1 bar" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Grams" value={servingGrams} onChangeText={setServingGrams} placeholder="45" keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={styles.sectionLabel}>NUTRITION PER SERVING</Text>
          <Text style={styles.sectionCaption}>Enter these exactly as printed on the label — we'll work out the per-100g figures automatically.</Text>
          <View style={styles.gridRow}>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Calories</Text>
              <TextInput value={calories} onChangeText={setCalories} keyboardType="decimal-pad" placeholder="e.g. 200" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Protein (g)</Text>
              <TextInput value={proteinG} onChangeText={setProteinG} keyboardType="decimal-pad" placeholder="e.g. 10" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Carbs (g)</Text>
              <TextInput value={carbsG} onChangeText={setCarbsG} keyboardType="decimal-pad" placeholder="e.g. 22" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Fat (g)</Text>
              <TextInput value={fatG} onChangeText={setFatG} keyboardType="decimal-pad" placeholder="e.g. 7" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>OPTIONAL DETAIL</Text>
          <View style={styles.gridRow}>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Fiber (g)</Text>
              <TextInput value={fiberG} onChangeText={setFiberG} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Sugar (g)</Text>
              <TextInput value={sugarG} onChangeText={setSugarG} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Sodium (mg)</Text>
              <TextInput value={sodiumMg} onChangeText={setSodiumMg} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Saturated fat (g)</Text>
              <TextInput value={saturatedFatG} onChangeText={setSaturatedFatG} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={Color.textFaint} style={styles.input} />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title={isEditing ? "Save changes" : "Save custom food"} onPress={handleSave} loading={saving} style={{ marginTop: Spacing.lg }} />

          {isEditing ? (
            <Pressable onPress={() => router.push({ pathname: "/submit-food", params: { id: params.id } })} style={styles.shareLink}>
              <Ionicons name="cloud-upload-outline" size={14} color={Color.gold} />
              <Text style={styles.shareLinkText}>Share this food publicly</Text>
            </Pressable>
          ) : null}
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
  hintBanner: { flexDirection: "row", gap: Spacing.xs, alignItems: "flex-start", backgroundColor: Color.goldWeak, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  hintBannerText: { flex: 1, fontSize: 11, color: Color.textSecondary, lineHeight: 15 },
  photoChip: { flexDirection: "row", gap: Spacing.xs, alignItems: "center", marginBottom: Spacing.md },
  photoChipText: { flex: 1, fontSize: 11, color: Color.textMuted, lineHeight: 15 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  sectionCaption: { fontSize: 11, color: Color.textMuted, lineHeight: 15, marginTop: -Spacing.xs, marginBottom: Spacing.sm },
  gridRow: { flexDirection: "row", gap: Spacing.sm },
  numberField: { flex: 1, marginBottom: Spacing.md },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Color.textPrimary,
  },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm },
  shareLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Spacing.md, paddingVertical: 6 },
  shareLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
});
