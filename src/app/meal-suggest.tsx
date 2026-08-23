import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type CameraCapturedPicture, type CameraMountError } from "expo-camera";
import { useRouter } from "expo-router";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CameraPermissionDenied, CameraUnavailable } from "@/components/nutrition/CameraPermissionGate";
import { Color, Radius, Spacing } from "@/constants/theme";
import { trackEvent } from "@/lib/analytics";
import { tapFeedback } from "@/lib/haptics";
import { parseIngredientText } from "@/lib/ingredient-text";
import { ApiError } from "@/lib/auth-context";
import { MEAL_TYPE_OPTIONS, useCreateFoodEntry, type MealType } from "@/lib/queries/nutrition-diary";
import { useMealSuggest, type MealSuggestion } from "@/lib/queries/meal-suggest";
import { useCreateRecipe } from "@/lib/queries/recipes";
import { useReceiptScan } from "@/lib/queries/receipt-scan";
import { todayDateString } from "@/lib/workout-formatters";

type Mode = "photo" | "receipt" | "text";
type Stage = "input" | "confirm" | "results";

// One row in the receipt-review stage — seeded from the AI's extraction,
// then fully editable/removable before anything is sent to meal-suggest.
// See "Important" in the brief: a receipt photo never feeds suggestions
// directly, only this confirmed-and-possibly-edited list does.
interface ConfirmItem {
  key: string;
  text: string;
  included: boolean;
  confidence: "confident" | "uncertain";
}

let confirmItemSeq = 0;
function nextConfirmKey(): string {
  confirmItemSeq += 1;
  return `ci-${confirmItemSeq}`;
}

function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function SuggestionCard({ suggestion }: { suggestion: MealSuggestion }) {
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const createEntry = useCreateFoodEntry();
  const createRecipe = useCreateRecipe();
  const [logged, setLogged] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleLog() {
    tapFeedback();
    try {
      await createEntry.mutateAsync({
        date: todayDateString(),
        mealType,
        name: suggestion.title,
        calories: suggestion.estimatedCalories,
        proteinG: suggestion.estimatedProteinG,
        carbsG: suggestion.estimatedCarbsG,
        fatG: suggestion.estimatedFatG,
      });
      setLogged(true);
      trackEvent("meal_suggest_logged", { title: suggestion.title });
    } catch {
      // Swallow — the button reverts to its normal state and the member can retry.
    }
  }

  async function handleSaveRecipe() {
    tapFeedback();
    try {
      await createRecipe.mutateAsync({
        title: suggestion.title,
        ingredients: suggestion.ingredientsUsed.map(parseIngredientText),
        notes: suggestion.description || null,
        source: "meal-suggest",
      });
      setSaved(true);
      trackEvent("meal_suggest_recipe_saved", { title: suggestion.title });
    } catch {
      // Swallow — button reverts, member can retry.
    }
  }

  return (
    <Card style={styles.suggestionCard}>
      <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
      {suggestion.description ? <Text style={styles.suggestionDesc}>{suggestion.description}</Text> : null}

      {suggestion.ingredientsUsed.length > 0 ? (
        <View style={styles.ingredientRow}>
          {suggestion.ingredientsUsed.map((ing) => (
            <View key={ing} style={styles.ingredientChip}>
              <Text style={styles.ingredientChipText}>{ing}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.macroRow}>
        <View style={styles.macroStat}>
          <Text style={styles.macroValue}>{suggestion.estimatedCalories}</Text>
          <Text style={styles.macroLabel}>kcal</Text>
        </View>
        <View style={styles.macroStat}>
          <Text style={styles.macroValue}>{suggestion.estimatedProteinG}g</Text>
          <Text style={styles.macroLabel}>protein</Text>
        </View>
        <View style={styles.macroStat}>
          <Text style={styles.macroValue}>{suggestion.estimatedCarbsG}g</Text>
          <Text style={styles.macroLabel}>carbs</Text>
        </View>
        <View style={styles.macroStat}>
          <Text style={styles.macroValue}>{suggestion.estimatedFatG}g</Text>
          <Text style={styles.macroLabel}>fat</Text>
        </View>
      </View>

      {suggestion.crossSuggestion ? (
        <View style={styles.crossRow}>
          <Ionicons name="bulb-outline" size={14} color={Color.gold} />
          <Text style={styles.crossText}>{suggestion.crossSuggestion}</Text>
        </View>
      ) : null}

      {logged ? (
        <View style={styles.loggedRow}>
          <Ionicons name="checkmark-circle" size={16} color={Color.success} />
          <Text style={styles.loggedText}>Logged to {mealType}</Text>
        </View>
      ) : (
        <>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setMealType(opt.value)}
                style={[styles.mealTypeChip, mealType === opt.value && styles.mealTypeChipActive]}
              >
                <Text style={[styles.mealTypeChipText, mealType === opt.value && styles.mealTypeChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            title="Log this"
            variant="secondary"
            onPress={handleLog}
            loading={createEntry.isPending}
            style={{ marginTop: Spacing.sm }}
          />
        </>
      )}

      {saved ? (
        <View style={styles.savedRow}>
          <Ionicons name="bookmark" size={14} color={Color.gold} />
          <Text style={styles.savedText}>Saved to recipes</Text>
        </View>
      ) : (
        <Pressable onPress={handleSaveRecipe} disabled={createRecipe.isPending} style={styles.saveRecipeRow}>
          <Ionicons name="bookmark-outline" size={14} color={Color.gold} />
          <Text style={styles.saveRecipeText}>{createRecipe.isPending ? "Saving…" : "Save recipe"}</Text>
        </Pressable>
      )}
    </Card>
  );
}

// Photograph or type the ingredients you have, get back meal/snack ideas
// makeable from them (plus common pantry staples). Suggestions are
// AI-estimated, not looked up — "Log this" writes the estimate straight to
// the diary the same way a free-hand entry would.
export default function MealSuggestScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("photo");
  const [stage, setStage] = useState<Stage>("input");
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [ingredientsText, setIngredientsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [confirmItems, setConfirmItems] = useState<ConfirmItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [ocrWasWeak, setOcrWasWeak] = useState(false);
  const mealSuggest = useMealSuggest();
  const receiptScan = useReceiptScan();

  function handleMountError(e: CameraMountError) {
    trackEvent("meal_suggest_camera_unavailable", { message: e.message });
    setCameraUnavailable(true);
  }

  async function handleCapture(cameraRef: CameraView | null) {
    if (!cameraRef || capturing) return;
    tapFeedback();
    setCapturing(true);
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.takePictureAsync({ quality: 0.5 });
      if (!photo) throw new Error("No photo captured");
      const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1000 } }], {
        compress: 0.5,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!resized.base64) throw new Error("Could not encode photo");
      setCapturedPhoto(`data:image/jpeg;base64,${resized.base64}`);
    } catch {
      setError("Couldn't capture that photo — try again.");
    } finally {
      setCapturing(false);
    }
  }

  // A receipt photo never goes straight into meal suggestions — it's read
  // into candidate line items here, then the member reviews/edits them on
  // the confirm stage before anything reaches generateMealSuggestions.
  // Empty/weak extraction still lands on the confirm stage (never a dead
  // end): an empty, clearly-labelled, fully-editable list beats a silent
  // failure or a generic error with nothing to do next.
  async function handleReceiptSubmit() {
    setError(null);
    if (!capturedPhoto) {
      setError("Add a photo of your receipt.");
      return;
    }
    try {
      const res = await receiptScan.mutateAsync(capturedPhoto);
      trackEvent("receipt_scan_requested", { count: res.items.length });
      setConfirmItems(
        res.items.map((it) => ({
          key: nextConfirmKey(),
          text: it.normalizedName,
          included: it.isFood,
          confidence: it.confidence,
        }))
      );
      setOcrWasWeak(res.items.length === 0);
      setStage("confirm");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't read that receipt right now. Please try again.");
    }
  }

  async function handleSubmit() {
    setError(null);

    if (mode === "receipt") {
      await handleReceiptSubmit();
      return;
    }

    if (!capturedPhoto && !ingredientsText.trim()) {
      setError("Add a photo or type what you've got.");
      return;
    }
    try {
      const res = await mealSuggest.mutateAsync({
        imageBase64: capturedPhoto,
        ingredientsText: ingredientsText.trim() || null,
      });
      trackEvent("meal_suggest_requested", { mode, count: res.suggestions.length });
      if (res.suggestions.length === 0) {
        setError("Couldn't spot anything usable there — try a clearer photo or list a few ingredients.");
        return;
      }
      setSuggestions(res.suggestions);
      setStage("results");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't get suggestions right now. Please try again.");
    }
  }

  function updateConfirmItem(key: string, patch: Partial<Omit<ConfirmItem, "key">>) {
    setConfirmItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeConfirmItem(key: string) {
    setConfirmItems((prev) => prev.filter((it) => it.key !== key));
  }

  function handleAddConfirmItem() {
    const text = newItemText.trim();
    if (!text) return;
    setConfirmItems((prev) => [...prev, { key: nextConfirmKey(), text, included: true, confidence: "confident" }]);
    setNewItemText("");
  }

  // The confirmed (possibly hand-edited) list is what actually reaches meal
  // suggestions — reusing the same generateMealSuggestions path as typing
  // ingredients directly, just pre-filled from the receipt.
  async function handleConfirmContinue() {
    setError(null);
    const confirmedText = confirmItems
      .filter((it) => it.included && it.text.trim())
      .map((it) => it.text.trim())
      .join(", ");
    if (!confirmedText) {
      setError("Select or add at least one item to continue.");
      return;
    }
    try {
      const res = await mealSuggest.mutateAsync({ imageBase64: null, ingredientsText: confirmedText });
      trackEvent("meal_suggest_requested", { mode: "receipt", count: res.suggestions.length });
      if (res.suggestions.length === 0) {
        setError("Couldn't come up with anything from those items — try adding a few more.");
        return;
      }
      setSuggestions(res.suggestions);
      setStage("results");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't get suggestions right now. Please try again.");
    }
  }

  function handleReset() {
    setStage("input");
    setCapturedPhoto(null);
    setIngredientsText("");
    setSuggestions([]);
    setConfirmItems([]);
    setNewItemText("");
    setOcrWasWeak(false);
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>What Can I Make?</Text>
        <View style={{ width: 22 }} />
      </View>

      {stage === "results" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.subhead}>A few ideas from what you&apos;ve got.</Text>
          {suggestions.map((s) => (
            <SuggestionCard key={s.title} suggestion={s} />
          ))}
          <Button title="Try again" variant="secondary" onPress={handleReset} style={{ marginTop: Spacing.sm }} />
        </ScrollView>
      ) : stage === "confirm" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.subhead}>
            {ocrWasWeak
              ? "Couldn't read much off that photo — add what you bought below."
              : "Here's what we read off your receipt — untick anything that's not food, fix anything misread, or add what's missing."}
          </Text>
          {confirmItems.map((item) => (
            <View key={item.key} style={styles.confirmRow}>
              <Pressable onPress={() => updateConfirmItem(item.key, { included: !item.included })} hitSlop={8}>
                <Ionicons
                  name={item.included ? "checkbox" : "square-outline"}
                  size={20}
                  color={item.included ? Color.gold : Color.textFaint}
                />
              </Pressable>
              <TextInput
                value={item.text}
                onChangeText={(v) => updateConfirmItem(item.key, { text: v })}
                style={styles.confirmInput}
                placeholderTextColor={Color.textFaint}
              />
              {item.confidence === "uncertain" ? (
                <View style={styles.uncertainBadge}>
                  <Text style={styles.uncertainBadgeText}>check</Text>
                </View>
              ) : null}
              <Pressable onPress={() => removeConfirmItem(item.key)} hitSlop={8}>
                <Ionicons name="close" size={18} color={Color.textFaint} />
              </Pressable>
            </View>
          ))}

          <View style={styles.confirmAddRow}>
            <TextInput
              value={newItemText}
              onChangeText={setNewItemText}
              placeholder="+ Add an item"
              placeholderTextColor={Color.textFaint}
              style={styles.confirmAddInput}
              onSubmitEditing={handleAddConfirmItem}
              returnKeyType="done"
            />
            <Pressable onPress={handleAddConfirmItem} disabled={!newItemText.trim()} style={styles.confirmAddButton}>
              <Ionicons name="add" size={18} color={Color.gold} />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            title="Get suggestions"
            onPress={handleConfirmContinue}
            loading={mealSuggest.isPending}
            disabled={!confirmItems.some((it) => it.included && it.text.trim())}
            style={{ marginTop: Spacing.md }}
          />
          <Button title="Retake photo" variant="secondary" onPress={handleReset} style={{ marginTop: Spacing.sm }} />
        </ScrollView>
      ) : (
        <>
          <View style={styles.modeToggle}>
            <Pressable
              onPress={() => setMode("photo")}
              style={[styles.modeChip, mode === "photo" && styles.modeChipActive]}
            >
              <Ionicons name="camera-outline" size={14} color={mode === "photo" ? Color.gold : Color.textMuted} />
              <Text style={[styles.modeChipText, mode === "photo" && styles.modeChipTextActive]}>Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("receipt")}
              style={[styles.modeChip, mode === "receipt" && styles.modeChipActive]}
            >
              <Ionicons name="receipt-outline" size={14} color={mode === "receipt" ? Color.gold : Color.textMuted} />
              <Text style={[styles.modeChipText, mode === "receipt" && styles.modeChipTextActive]}>Receipt</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("text")}
              style={[styles.modeChip, mode === "text" && styles.modeChipActive]}
            >
              <Ionicons name="create-outline" size={14} color={mode === "text" ? Color.gold : Color.textMuted} />
              <Text style={[styles.modeChipText, mode === "text" && styles.modeChipTextActive]}>Type it</Text>
            </Pressable>
          </View>

          {mode === "receipt" ? (
            <Text style={styles.receiptHint}>
              Photograph a shopping receipt — you&apos;ll get to review what we read before it&apos;s used.
            </Text>
          ) : null}

          {mode === "photo" || mode === "receipt" ? (
            capturedPhoto ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
                <Pressable onPress={() => setCapturedPhoto(null)} style={styles.retakeButton}>
                  <Ionicons name="refresh" size={14} color={Color.textPrimary} />
                  <Text style={styles.retakeText}>Retake</Text>
                </Pressable>
              </View>
            ) : !permission ? (
              <View style={styles.centerFill}>
                <ActivityIndicator color={Color.gold} size="large" />
              </View>
            ) : !permission.granted ? (
              <CameraPermissionDenied
                canAskAgain={permission.canAskAgain}
                requestPermission={requestPermission}
                message={
                  mode === "receipt"
                    ? "S&C Coaching needs camera access to photograph your receipt."
                    : "S&C Coaching needs camera access to photograph your ingredients."
                }
              />
            ) : (
              <View style={styles.cameraWrap}>
                {cameraUnavailable ? (
                  <CameraUnavailable onFallback={() => setMode("text")} />
                ) : (
                  <CameraCaptureLayer onMountError={handleMountError} onCapture={handleCapture} capturing={capturing} />
                )}
              </View>
            )
          ) : (
            <View style={styles.textInputWrap}>
              <TextInput
                value={ingredientsText}
                onChangeText={setIngredientsText}
                placeholder="e.g. chicken breast, spinach, rice, half an onion"
                placeholderTextColor={Color.textFaint}
                multiline
                style={styles.textInput}
              />
            </View>
          )}

          {mode === "photo" && capturedPhoto ? (
            <View style={styles.textInputWrap}>
              <TextInput
                value={ingredientsText}
                onChangeText={setIngredientsText}
                placeholder="Anything else? (optional)"
                placeholderTextColor={Color.textFaint}
                style={styles.textInputSingle}
              />
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.footer}>
            <Button
              title={mode === "receipt" ? "Scan receipt" : "Get suggestions"}
              onPress={handleSubmit}
              loading={mode === "receipt" ? receiptScan.isPending : mealSuggest.isPending}
              disabled={
                mode === "text" ? !ingredientsText.trim() : !capturedPhoto
              }
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// Isolated so the CameraView (and its ref) only mount once permission +
// unavailability are already resolved by the parent.
function CameraCaptureLayer({
  onMountError,
  onCapture,
  capturing,
}: {
  onMountError: (e: CameraMountError) => void;
  onCapture: (ref: CameraView | null) => void;
  capturing: boolean;
}) {
  const [ref, setRef] = useState<CameraView | null>(null);
  return (
    <>
      <CameraView ref={setRef} style={StyleSheet.absoluteFill} onMountError={onMountError} />
      <View style={styles.frame} />
      <Pressable
        onPress={() => onCapture(ref)}
        disabled={capturing}
        style={styles.captureButton}
      >
        <View style={styles.captureButtonInner} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  subhead: { fontSize: 12, color: Color.textMuted, marginBottom: Spacing.md },
  modeToggle: { flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  modeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  modeChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  modeChipTextActive: { color: Color.gold },
  cameraWrap: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Color.surface1,
  },
  frame: {
    position: "absolute",
    top: "12%",
    left: "8%",
    right: "8%",
    bottom: "24%",
    borderWidth: 2,
    borderColor: Color.gold,
    borderRadius: Radius.md,
  },
  captureButton: {
    position: "absolute",
    bottom: Spacing.lg,
    alignSelf: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: Color.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: Color.gold },
  previewWrap: { flex: 1, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.lg, overflow: "hidden" },
  previewImage: { flex: 1, width: "100%" },
  retakeButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  retakeText: { fontSize: 11, fontWeight: "600", color: Color.textPrimary },
  textInputWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  textInput: {
    minHeight: 100,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.md,
    fontSize: 14,
    color: Color.textPrimary,
    textAlignVertical: "top",
  },
  textInputSingle: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
    color: Color.textPrimary,
  },
  errorText: { fontSize: 12, color: Color.warning, textAlign: "center", marginBottom: Spacing.sm },
  receiptHint: { fontSize: 12, color: Color.textMuted, textAlign: "center", paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  confirmInput: { flex: 1, fontSize: 14, color: Color.textPrimary, paddingVertical: 4 },
  uncertainBadge: { borderRadius: Radius.pill, backgroundColor: Color.warningWeak, paddingHorizontal: 6, paddingVertical: 2 },
  uncertainBadgeText: { fontSize: 9, fontWeight: "700", color: Color.warning, textTransform: "uppercase" },
  confirmAddRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  confirmAddInput: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  confirmAddButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  suggestionCard: { padding: Spacing.md, marginBottom: Spacing.md },
  suggestionTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  suggestionDesc: { fontSize: 12, color: Color.textMuted, marginTop: 4, lineHeight: 17 },
  ingredientRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  ingredientChip: { borderRadius: Radius.pill, backgroundColor: Color.surface2, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  ingredientChipText: { fontSize: 10, color: Color.textSecondary },
  macroRow: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.md },
  macroStat: {},
  macroValue: { fontSize: 15, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  macroLabel: { fontSize: 10, color: Color.textMuted, marginTop: 1 },
  crossRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: Spacing.sm },
  crossText: { flex: 1, fontSize: 11, color: Color.textMuted, lineHeight: 16 },
  mealTypeRow: { flexDirection: "row", gap: 6, marginTop: Spacing.md },
  mealTypeChip: { flex: 1, alignItems: "center", borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingVertical: 6 },
  mealTypeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  mealTypeChipText: { fontSize: 10, fontWeight: "600", color: Color.textMuted },
  mealTypeChipTextActive: { color: Color.gold },
  loggedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing.md },
  loggedText: { fontSize: 12, fontWeight: "600", color: Color.success },
  saveRecipeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Spacing.sm, paddingVertical: 6 },
  saveRecipeText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  savedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Spacing.sm },
  savedText: { fontSize: 12, fontWeight: "600", color: Color.gold },
});
