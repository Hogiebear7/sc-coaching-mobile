import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type CameraCapturedPicture, type CameraMountError } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useRef, useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraPermissionDenied, CameraUnavailable } from "@/components/nutrition/CameraPermissionGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { tapFeedback } from "@/lib/haptics";
import { usePhotoFoodScan, type IdentifiedFoodItem } from "@/lib/queries/food-catalog";
import { useCreateFoodEntry, type MealType } from "@/lib/queries/nutrition-diary";
import { todayDateString } from "@/lib/workout-formatters";

type Stage = "camera" | "scanning" | "reviewing";

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

export default function LabelScanScreen() {
  const router = useRouter();
  const { barcode, date, mealType } = useLocalSearchParams<{ barcode?: string; date?: string; mealType?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [stage, setStage] = useState<Stage>("camera");
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const photoScan = usePhotoFoodScan();
  const createEntry = useCreateFoodEntry();

  const effectiveDate = date || todayDateString();
  const effectiveMealType = (mealType as MealType) || defaultMealTypeForNow();

  useEffect(() => {
    trackEvent("label_scan_started", { hasBarcode: !!barcode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToManualForm(prefillSource: string, extra?: Record<string, string>) {
    router.replace({
      pathname: "/custom-food",
      params: { barcode: barcode ?? "", date: effectiveDate, mealType: effectiveMealType, prefillSource, ...extra },
    });
  }

  function handleMountError(e: CameraMountError) {
    trackEvent("label_scan_camera_unavailable", { message: e.message });
    setCameraUnavailable(true);
  }

  async function handleCapture() {
    if (!cameraRef.current || stage !== "camera") return;
    tapFeedback();
    setScanError(null);
    setStage("scanning");

    // Capture/encode failures mean we never got a usable photo at all —
    // nothing to retry the AI call with, so this still falls straight to
    // manual entry (same as before AI vision existed).
    let imageBase64: string;
    try {
      // Two lossy JPEG encodes compound: a low capture quality plus a low
      // re-compress can leave labels unreadable and plates indistinct to the
      // model, which correctly (per its own instructions) reports nothing
      // identifiable rather than guessing. Stay well under the server's 3MB
      // cap while keeping enough detail for both cases.
      const photo: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo) throw new Error("No photo captured");
      const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1280 } }], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
      if (!resized.base64) throw new Error("Could not encode photo");
      imageBase64 = `data:image/jpeg;base64,${resized.base64}`;
    } catch {
      trackEvent("label_scan_manual_fallback", { reason: "capture_failed" });
      goToManualForm("label_scan_capture_failed");
      return;
    }

    setCapturedPhoto(imageBase64);

    try {
      const res = await photoScan.mutateAsync(imageBase64);

      if (res.items.length === 0) {
        // The AI call itself succeeded — it genuinely found nothing
        // food/label-related in the photo. This is the only case that
        // should read as "nothing recognized".
        trackEvent("label_scan_manual_fallback", { reason: "nothing_identified" });
        goToManualForm("food_photo_scan_empty", { capturedLabelPhoto: imageBase64 });
        return;
      }

      trackEvent("label_scan_items_identified", { count: res.items.length, hasBarcode: !!barcode });
      setItems(res.items.map((item, i) => ({ ...item, id: `item-${i}`, included: true })));
      setStage("reviewing");
    } catch (e) {
      // A real failure — not configured, rate-limited, network error, or a
      // server error — is NOT the same thing as "nothing recognized". Show
      // it and let the member retry with the same photo conditions rather
      // than silently redirecting to manual entry, which reads identically
      // to a genuine miss and hides what actually went wrong.
      const message = e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection and try again.";
      trackEvent("label_scan_manual_fallback", { reason: e instanceof Error ? e.message : "unknown" });
      setScanError(message);
      setStage("camera");
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

  function saveAsCustomFood(item: ReviewItem) {
    goToManualForm("food_photo_scan", {
      name: item.name,
      calories: String(item.calories),
      proteinG: String(item.proteinG),
      carbsG: String(item.carbsG),
      fatG: String(item.fatG),
      servingLabel: item.servingDescription,
      ...(capturedPhoto ? { capturedLabelPhoto: capturedPhoto } : {}),
    });
  }

  async function handleLogIncluded() {
    const included = items.filter((it) => it.included);
    if (included.length === 0) return;
    setError(null);
    setLogging(true);
    try {
      for (const item of included) {
        // Entries must be created one at a time — there's no batch-create endpoint.
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
      setError(e instanceof ApiError ? e.message : "Could not log this food. Please try again.");
    } finally {
      setLogging(false);
    }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Scan Food</Text>
          <View style={{ width: 22 }} />
        </View>
        <CameraPermissionDenied
          canAskAgain={permission.canAskAgain}
          requestPermission={requestPermission}
          message="S&C Coaching needs camera access to identify food from a photo."
        />
        <Pressable onPress={() => goToManualForm("label_scan_no_permission")} style={styles.manualLink}>
          <Text style={styles.manualLinkText}>Enter this food manually instead</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (stage === "scanning") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="sparkles" size={26} color={Color.goldForeground} />
          </View>
          <Text style={styles.confirmTitle}>Photo captured</Text>
          <Text style={styles.confirmText}>Identifying what&apos;s in the photo…</Text>
          <ActivityIndicator color={Color.gold} size="small" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === "reviewing") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => setStage("camera")} hitSlop={12} style={styles.backButton}>
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

              <View style={styles.itemMetaRow}>
                <Text style={styles.servingText}>{item.servingDescription || "Serving not specified"}</Text>
                <View style={[styles.sourceBadge, item.source === "label" && styles.sourceBadgeLabel]}>
                  <Text style={[styles.sourceBadgeText, item.source === "label" && styles.sourceBadgeTextLabel]}>
                    {item.source === "label" ? "From label" : "Estimated"}
                  </Text>
                </View>
              </View>

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

              {barcode ? (
                <Pressable onPress={() => saveAsCustomFood(item)} style={styles.saveCustomLink}>
                  <Text style={styles.saveCustomLinkText}>Save as a reusable food instead</Text>
                </Pressable>
              ) : null}
            </Card>
          ))}

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Everything was removed. Retake a photo or enter this food manually.</Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={items.filter((i) => i.included).length > 1 ? `Log ${items.filter((i) => i.included).length} items` : "Log this food"}
            onPress={handleLogIncluded}
            loading={logging}
            disabled={items.filter((i) => i.included).length === 0}
            style={{ marginTop: Spacing.lg }}
          />
          <Pressable onPress={() => setStage("camera")} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>Retake photo</Text>
          </Pressable>
          <Pressable onPress={() => goToManualForm("label_scan_skipped")} style={styles.manualLink}>
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
        <Text style={styles.headerTitle}>Scan Food</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={styles.subhead}>
        {barcode
          ? "Couldn't find that barcode — photograph the food or its nutrition label and we'll identify it."
          : "Photograph your food, a meal, or a nutrition label — we'll identify it and estimate the nutrition."}
      </Text>

      <View style={styles.cameraWrap}>
        {cameraUnavailable ? (
          <CameraUnavailable onFallback={() => goToManualForm("label_scan_camera_unavailable")} />
        ) : (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} onMountError={handleMountError} />
            <View style={styles.frame} />
          </>
        )}
      </View>

      <Text style={styles.hint}>Fill the frame with the food or label, then capture</Text>

      {scanError ? <Text style={styles.scanErrorText}>{scanError} Tap the button to try again.</Text> : null}

      <Pressable onPress={handleCapture} disabled={cameraUnavailable} style={styles.captureButton}>
        <View style={styles.captureButtonInner} />
      </Pressable>

      <Pressable onPress={() => goToManualForm("label_scan_skipped")} style={styles.manualLink}>
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
  cameraWrap: { flex: 1, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Color.surface1 },
  frame: {
    position: "absolute",
    top: "15%",
    left: "8%",
    right: "8%",
    bottom: "15%",
    borderWidth: 2,
    borderColor: Color.gold,
    borderRadius: Radius.md,
  },
  hint: { textAlign: "center", fontSize: 12, color: Color.textMuted, marginTop: Spacing.md },
  scanErrorText: { textAlign: "center", fontSize: 12, color: Color.danger, marginTop: Spacing.sm, paddingHorizontal: Spacing.xl },
  captureButton: {
    alignSelf: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: Color.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  captureButtonInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: Color.gold },
  manualLink: { alignItems: "center", paddingVertical: Spacing.lg },
  manualLinkText: { fontSize: 13, color: Color.gold, fontWeight: "600" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  itemCard: { padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  itemCardExcluded: { opacity: 0.5 },
  itemHeaderRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  checkbox: { padding: 2 },
  nameInput: { flex: 1, fontSize: 14, fontWeight: "700", color: Color.textPrimary, paddingVertical: 4 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  servingText: { fontSize: 12, color: Color.textMuted },
  sourceBadge: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  sourceBadgeLabel: { borderColor: Color.gold },
  sourceBadgeText: { fontSize: 10, fontWeight: "600", color: Color.textFaint },
  sourceBadgeTextLabel: { color: Color.gold },
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
  saveCustomLink: { alignItems: "flex-start", marginTop: 2 },
  saveCustomLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xl },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm, textAlign: "center" },
});
