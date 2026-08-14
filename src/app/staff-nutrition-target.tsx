import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { tapFeedback } from "@/lib/haptics";
import { useStaffNutritionTarget, useUpdateStaffNutritionTarget, type NutritionTargetMode } from "@/lib/queries/nutrition-diary";

// Quick presets so a coach isn't doing macro math on their phone — grams
// derived from a simple 4/4/9 kcal-per-gram split at common ratios.
const PRESETS: { label: string; calories: number; proteinG: number; carbsG: number; fatG: number }[] = [
  { label: "Fat loss (moderate)", calories: 1800, proteinG: 150, carbsG: 150, fatG: 55 },
  { label: "Maintenance", calories: 2200, proteinG: 150, carbsG: 220, fatG: 70 },
  { label: "Muscle gain", calories: 2700, proteinG: 170, carbsG: 320, fatG: 80 },
];

const MODE_OPTIONS: { value: NutritionTargetMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "The app calculates this member's target from their weight, training load, and logged food — no setup needed. This is the default for everyone." },
  { value: "manual", label: "Manual", hint: "Set your own fixed numbers below — the member sees exactly this every day." },
  { value: "disabled", label: "Off", hint: "No target is shown to the member at all. Logging still works." },
];

export default function StaffNutritionTargetScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data: existing, isLoading } = useStaffNutritionTarget(userId);
  const update = useUpdateStaffNutritionTarget();

  const [mode, setMode] = useState<NutritionTargetMode>("auto");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || isLoading) return;
    if (existing) {
      setMode(existing.mode);
      if (existing.calories !== null) setCalories(String(existing.calories));
      if (existing.proteinG !== null) setProteinG(String(existing.proteinG));
      if (existing.carbsG !== null) setCarbsG(String(existing.carbsG));
      if (existing.fatG !== null) setFatG(String(existing.fatG));
      setNotes(existing.notes ?? "");
    }
    setHydrated(true);
  }, [existing, hydrated, isLoading]);

  function applyPreset(p: (typeof PRESETS)[number]) {
    tapFeedback();
    setCalories(String(p.calories));
    setProteinG(String(p.proteinG));
    setCarbsG(String(p.carbsG));
    setFatG(String(p.fatG));
  }

  async function handleSave() {
    setError(null);

    if (mode !== "manual") {
      try {
        await update.mutateAsync({ userId, mode, notes: notes.trim() || undefined });
        tapFeedback();
        router.back();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not save this target. Please try again.");
      }
      return;
    }

    const cals = parseInt(calories, 10);
    const protein = parseInt(proteinG, 10);
    const carbs = parseInt(carbsG, 10);
    const fat = parseInt(fatG, 10);
    if ([cals, protein, carbs, fat].some((n) => !Number.isFinite(n) || n < 0)) {
      setError("Calories and macros must be non-negative numbers.");
      return;
    }

    try {
      await update.mutateAsync({ userId, mode, calories: cals, proteinG: protein, carbsG: carbs, fatG: fat, notes: notes.trim() || undefined });
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this target. Please try again.");
    }
  }

  if (isLoading && !hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
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
          <Text style={styles.headerTitle}>Nutrition Target</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>TARGET MODE</Text>
          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  tapFeedback();
                  setMode(opt.value);
                }}
                style={[styles.modeChip, mode === opt.value && styles.modeChipActive]}
              >
                <Text style={[styles.modeChipText, mode === opt.value && styles.modeChipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
          <Card style={styles.hintCard}>
            <Text style={styles.hintText}>{MODE_OPTIONS.find((o) => o.value === mode)?.hint}</Text>
          </Card>

          {mode === "manual" && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>QUICK PRESETS</Text>
              <View style={styles.presetRow}>
                {PRESETS.map((p) => (
                  <Pressable key={p.label} onPress={() => applyPreset(p)} style={styles.presetChip}>
                    <Text style={styles.presetChipText}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.gridRow}>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Calories (kcal)</Text>
                  <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" placeholder="e.g. 2200" placeholderTextColor={Color.textFaint} style={styles.input} />
                </View>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Protein (g)</Text>
                  <TextInput value={proteinG} onChangeText={setProteinG} keyboardType="number-pad" placeholder="e.g. 150" placeholderTextColor={Color.textFaint} style={styles.input} />
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Carbs (g)</Text>
                  <TextInput value={carbsG} onChangeText={setCarbsG} keyboardType="number-pad" placeholder="e.g. 220" placeholderTextColor={Color.textFaint} style={styles.input} />
                </View>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>Fat (g)</Text>
                  <TextInput value={fatG} onChangeText={setFatG} keyboardType="number-pad" placeholder="e.g. 70" placeholderTextColor={Color.textFaint} style={styles.input} />
                </View>
              </View>
            </>
          )}

          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. Reassess in 2 weeks" multiline style={styles.multiline} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Save target" onPress={handleSave} loading={update.isPending} style={{ marginTop: Spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  modeRow: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.sm },
  modeChip: { flex: 1, borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingVertical: 8, alignItems: "center" },
  modeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  modeChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  modeChipTextActive: { color: Color.gold },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.lg },
  presetChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  presetChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  gridRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  numberField: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 4 },
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
  multiline: { height: 70, paddingTop: 10, textAlignVertical: "top" },
  hintCard: { padding: Spacing.md, marginTop: Spacing.sm },
  hintText: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
});
