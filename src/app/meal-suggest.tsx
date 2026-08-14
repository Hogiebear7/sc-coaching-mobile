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
import { ApiError } from "@/lib/auth-context";
import { MEAL_TYPE_OPTIONS, useCreateFoodEntry, type MealType } from "@/lib/queries/nutrition-diary";
import { useMealSuggest, type MealSuggestion } from "@/lib/queries/meal-suggest";
import { todayDateString } from "@/lib/workout-formatters";

type Mode = "photo" | "text";
type Stage = "input" | "results";

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
  const [logged, setLogged] = useState(false);

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
  const mealSuggest = useMealSuggest();

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

  async function handleSubmit() {
    setError(null);
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

  function handleReset() {
    setStage("input");
    setCapturedPhoto(null);
    setIngredientsText("");
    setSuggestions([]);
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
          <Text style={styles.subhead}>A few ideas from what you've got.</Text>
          {suggestions.map((s) => (
            <SuggestionCard key={s.title} suggestion={s} />
          ))}
          <Button title="Try again" variant="secondary" onPress={handleReset} style={{ marginTop: Spacing.sm }} />
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
              onPress={() => setMode("text")}
              style={[styles.modeChip, mode === "text" && styles.modeChipActive]}
            >
              <Ionicons name="create-outline" size={14} color={mode === "text" ? Color.gold : Color.textMuted} />
              <Text style={[styles.modeChipText, mode === "text" && styles.modeChipTextActive]}>Type it</Text>
            </Pressable>
          </View>

          {mode === "photo" ? (
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
                message="S&C Coaching needs camera access to photograph your ingredients."
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
              title="Get suggestions"
              onPress={handleSubmit}
              loading={mealSuggest.isPending}
              disabled={mode === "photo" && !capturedPhoto && !ingredientsText.trim()}
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
});
