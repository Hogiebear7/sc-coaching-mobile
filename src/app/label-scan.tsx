import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { launchCameraAsync, launchImageLibraryAsync, useCameraPermissions } from "expo-image-picker";
import { useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraPermissionDenied } from "@/components/nutrition/CameraPermissionGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { tapFeedback } from "@/lib/haptics";
import { useDescribeFoodText, usePhotoFoodScan, useSaveFoodIdentificationOverride, type IdentifiedFoodItem } from "@/lib/queries/food-catalog";
import { useCreateFoodEntry, type MealType } from "@/lib/queries/nutrition-diary";
import { todayDateString } from "@/lib/workout-formatters";

type Stage = "camera" | "scanning" | "reviewing";

interface ReviewItem extends IdentifiedFoodItem {
  id: string;
  included: boolean;
  /** The AI's own identified name at scan time, before any edits — the
      match key an "Always use this instead" save trigger on, since the
      point is "next time the AI says this again", not "next time I type
      whatever I edited it to". */
  originalName: string;
  overrideSaved: boolean;
  /** The multiplier applied to base* below — quantity is the most common
      correction, so it gets its own structured control rather than living
      only in the free-text fallback. Resets to 1 whenever a macro field is
      hand-edited directly (see updateItem), so stepping quantity afterward
      scales from the value the member actually typed, not a stale AI read. */
  quantity: number;
  baseCalories: number;
  baseProteinG: number;
  baseCarbsG: number;
  baseFatG: number;
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
  const [stage, setStage] = useState<Stage>("camera");
  // Launches the system camera app rather than embedding a live preview —
  // an embedded expo-camera CameraView was hitting a real native "Failed to
  // capture image" race on-device (its CameraX session isn't always bound
  // by the time a capture is requested, and it remounts on every retry).
  // Handing capture off entirely to the OS's own camera activity sidesteps
  // that whole class of failure, same as most mainstream food-logging apps.
  const [launching, setLaunching] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const photoScan = usePhotoFoodScan();
  const createEntry = useCreateFoodEntry();
  const saveOverride = useSaveFoodIdentificationOverride();
  const describeFood = useDescribeFoodText();
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);

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

  // Shared by both entry points below (live capture and library pick) —
  // the AI scan endpoint doesn't care where the image came from, and
  // recipe-app screenshots (a table of nutrition facts, same shape as a
  // packaged food's label) go through the exact same "read the numbers off
  // the image" path as a photographed nutrition label.
  async function processPickedPhoto(photoUri: string) {
    setStage("scanning");

    // A resize/encode failure here used to be swallowed silently and
    // bounced straight to manual entry — indistinguishable from "AI found
    // nothing" and impossible to diagnose remotely. Surface it like the AI
    // call's own failures below, and let the member retry instead of
    // assuming it's unrecoverable.
    let imageBase64: string;
    try {
      // Two lossy JPEG encodes compound: a low capture quality plus a low
      // re-compress can leave labels unreadable and plates indistinct to the
      // model, which correctly (per its own instructions) reports nothing
      // identifiable rather than guessing. Stay well under the server's 3MB
      // cap while keeping enough detail for both cases.
      const resized = await manipulateAsync(photoUri, [{ resize: { width: 1280 } }], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
      if (!resized.base64) throw new Error("Could not encode photo");
      imageBase64 = `data:image/jpeg;base64,${resized.base64}`;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      trackEvent("label_scan_manual_fallback", { reason: `resize_failed: ${reason}` });
      setScanError(`Couldn't process that photo (${reason}).`);
      setStage("camera");
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
      setItems(
        res.items.map((item, i) => ({
          ...item,
          id: `item-${i}`,
          included: true,
          originalName: item.name,
          overrideSaved: false,
          quantity: 1,
          baseCalories: item.calories,
          baseProteinG: item.proteinG,
          baseCarbsG: item.carbsG,
          baseFatG: item.fatG,
        }))
      );
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

  async function handleCapture() {
    if (stage !== "camera" || launching) return;
    tapFeedback();
    setScanError(null);
    setLaunching(true);

    // The system camera activity owns the whole capture UI (framing,
    // retake, confirm) — we only get control back once the member has
    // confirmed a photo or backed out.
    let photoUri: string;
    try {
      const result = await launchCameraAsync({ quality: 0.9, mediaTypes: ["images"], exif: false });
      if (result.canceled || !result.assets?.[0]) {
        // Backed out of the system camera — not a failure, stay put.
        setLaunching(false);
        return;
      }
      photoUri = result.assets[0].uri;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      trackEvent("label_scan_manual_fallback", { reason: `camera_launch_failed: ${reason}` });
      setScanError(`Couldn't open the camera (${reason}).`);
      setLaunching(false);
      return;
    }

    setLaunching(false);
    await processPickedPhoto(photoUri);
  }

  async function handlePickFromLibrary() {
    if (stage !== "camera" || launching) return;
    tapFeedback();
    setScanError(null);
    setLaunching(true);

    // expo-image-picker's own system picker (Android's Photo Picker on 13+,
    // a standard gallery intent on older versions) handles whatever
    // permission it needs internally — no separate permission-gate UI
    // needed here the way camera access has one above.
    let photoUri: string;
    try {
      const result = await launchImageLibraryAsync({ quality: 0.9, mediaTypes: ["images"], exif: false });
      if (result.canceled || !result.assets?.[0]) {
        setLaunching(false);
        return;
      }
      photoUri = result.assets[0].uri;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      trackEvent("label_scan_manual_fallback", { reason: `library_launch_failed: ${reason}` });
      setScanError(`Couldn't open your photos (${reason}).`);
      setLaunching(false);
      return;
    }

    setLaunching(false);
    await processPickedPhoto(photoUri);
  }

  function updateItem(id: string, patch: Partial<Pick<ReviewItem, "name" | "calories" | "proteinG" | "carbsG" | "fatG">>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        // A hand-typed macro value is a fresh source of truth — reset the
        // quantity multiplier to 1× against it so the stepper scales from
        // what the member actually typed, not the original AI read.
        const macroEdited = "calories" in patch || "proteinG" in patch || "carbsG" in patch || "fatG" in patch;
        if (macroEdited) {
          next.baseCalories = next.calories;
          next.baseProteinG = next.proteinG;
          next.baseCarbsG = next.carbsG;
          next.baseFatG = next.fatG;
          next.quantity = 1;
        }
        return next;
      })
    );
  }

  function updateQuantity(id: string, quantity: number) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              quantity,
              calories: Math.round(it.baseCalories * quantity),
              proteinG: Math.round(it.baseProteinG * quantity),
              carbsG: Math.round(it.baseCarbsG * quantity),
              fatG: Math.round(it.baseFatG * quantity),
            }
          : it
      )
    );
  }

  function toggleItem(id: string) {
    tapFeedback();
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, included: !it.included } : it)));
  }

  function removeItem(id: string) {
    tapFeedback();
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleAlwaysUseThis(item: ReviewItem) {
    tapFeedback();
    try {
      await saveOverride.mutateAsync({
        triggerLabel: item.originalName,
        preferredFood: {
          name: item.name,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          servingDescription: item.servingDescription,
        },
      });
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, overrideSaved: true } : it)));
    } catch {
      // Non-critical — the item can still be logged normally either way, so
      // a failed save here shouldn't block the review flow with an error.
    }
  }

  async function handleSubmitCorrection(item: ReviewItem) {
    if (!correctionText.trim()) return;
    tapFeedback();
    setCorrectionError(null);
    try {
      const res = await describeFood.mutateAsync({
        descriptionText: correctionText.trim(),
        existingItem: {
          name: item.name,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          servingDescription: item.servingDescription,
        },
      });
      const corrected = res.items[0];
      if (!corrected) {
        setCorrectionError("Couldn't apply that correction — try describing it differently.");
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                name: corrected.name,
                calories: corrected.calories,
                proteinG: corrected.proteinG,
                carbsG: corrected.carbsG,
                fatG: corrected.fatG,
                servingDescription: corrected.servingDescription,
                // The correction is the new 1× baseline — same reasoning as
                // a hand-typed macro edit in updateItem.
                baseCalories: corrected.calories,
                baseProteinG: corrected.proteinG,
                baseCarbsG: corrected.carbsG,
                baseFatG: corrected.fatG,
                quantity: 1,
              }
            : it
        )
      );
      setCorrectingId(null);
      setCorrectionText("");
    } catch (e) {
      setCorrectionError(e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection and try again.");
    }
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
      // No state update after this point on success: the screen is
      // already being dismissed as a fullScreenModal, and re-rendering
      // (e.g. flipping `logging` back off, which swaps the Button's
      // ActivityIndicator back to text) while that native dismiss
      // transition is in flight is what was crashing the app — the
      // entries were already saved by this point, so there's nothing
      // left for this screen to reflect anyway. Only the error path
      // below needs to reset `logging`, since that's the one case the
      // screen stays mounted and the button must become tappable again.
    } catch (e) {
      setLogging(false);
      setError(e instanceof ApiError ? e.message : "Could not log this food. Please try again.");
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
                <Pressable onPress={() => removeItem(item.id)} hitSlop={8} accessibilityLabel="Remove this item">
                  <Ionicons name="trash-outline" size={17} color={Color.textFaint} />
                </Pressable>
              </View>

              <View style={styles.itemMetaRow}>
                <Text style={styles.servingText}>{item.servingDescription || "Serving not specified"}</Text>
                <View style={styles.badgeGroup}>
                  {item.overridden ? (
                    <View style={[styles.sourceBadge, styles.sourceBadgeLabel]}>
                      <Text style={[styles.sourceBadgeText, styles.sourceBadgeTextLabel]}>Using your correction</Text>
                    </View>
                  ) : null}
                  <View style={[styles.sourceBadge, item.source === "label" && styles.sourceBadgeLabel]}>
                    <Text style={[styles.sourceBadgeText, item.source === "label" && styles.sourceBadgeTextLabel]}>
                      {item.source === "label" ? "From label" : "Estimated"}
                    </Text>
                  </View>
                </View>
              </View>

              <Stepper
                label="Quantity"
                value={item.quantity}
                onChange={(v) => updateQuantity(item.id, v)}
                min={0.25}
                max={10}
                step={0.25}
                suffix="× serving"
              />

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

              {/* One reveal level, one job: quantity and direct macro edits
                  above cover the common fixes, so this footer is purely the
                  fallback + lower-frequency actions — visually separated
                  and quieter than the review content above it. */}
              <View style={styles.itemFooter}>
                {correctingId === item.id ? (
                  <View style={styles.correctionWrap}>
                    <View style={styles.correctionHeaderRow}>
                      <Ionicons name="sparkles-outline" size={13} color={Color.gold} />
                      <Text style={styles.correctionHeaderText}>Describe the fix</Text>
                    </View>
                    <TextInput
                      value={correctionText}
                      onChangeText={setCorrectionText}
                      placeholder={`e.g. "it's oat milk, not cow's milk" or "no cheese"`}
                      placeholderTextColor={Color.textFaint}
                      style={styles.correctionInput}
                      autoFocus
                    />
                    {correctionError ? <Text style={styles.error}>{correctionError}</Text> : null}
                    <View style={styles.correctionActions}>
                      <Pressable
                        onPress={() => {
                          setCorrectingId(null);
                          setCorrectionText("");
                          setCorrectionError(null);
                        }}
                        style={styles.correctionCancel}
                      >
                        <Text style={styles.footerLinkText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleSubmitCorrection(item)}
                        disabled={!correctionText.trim() || describeFood.isPending}
                        style={styles.correctionSubmit}
                      >
                        <Text style={styles.correctionSubmitText}>{describeFood.isPending ? "Applying…" : "Apply"}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      tapFeedback();
                      setCorrectingId(item.id);
                      setCorrectionText("");
                      setCorrectionError(null);
                    }}
                    style={styles.footerLink}
                  >
                    <Text style={styles.footerLinkText}>Fix something else</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleAlwaysUseThis(item)}
                  disabled={item.overrideSaved || saveOverride.isPending}
                  style={styles.footerLinkQuiet}
                >
                  <Text style={styles.footerLinkQuietText}>
                    {item.overrideSaved
                      ? "Saved — we'll recognize this next time you scan it."
                      : `Always use this instead of "${item.originalName}"`}
                  </Text>
                </Pressable>

                {barcode ? (
                  <Pressable onPress={() => saveAsCustomFood(item)} style={styles.footerLinkQuiet}>
                    <Text style={styles.footerLinkQuietText}>Save as a reusable food instead</Text>
                  </Pressable>
                ) : null}
              </View>
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
          <Pressable onPress={() => setStage("camera")} style={styles.retakeLink}>
            <Ionicons name="camera-reverse-outline" size={15} color={Color.gold} />
            <Text style={styles.retakeLinkText}>Retake photo</Text>
          </Pressable>
          <Pressable onPress={() => goToManualForm("label_scan_skipped")} style={styles.manualLinkQuiet}>
            <Text style={styles.manualLinkQuietText}>Enter a food manually instead</Text>
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

      <View style={styles.centerFill}>
        <View style={styles.confirmIconWrap}>
          <Ionicons name="camera" size={26} color={Color.goldForeground} />
        </View>
        <Text style={styles.confirmTitle}>{barcode ? "Couldn't find that barcode" : "Photograph your food"}</Text>
        <Text style={styles.confirmText}>
          {barcode
            ? "Photograph the food or its nutrition label and we'll identify it."
            : "A single item, a full plate, a nutrition label, or a screenshot of a recipe's nutrition info — we'll identify it and estimate the nutrition."}
        </Text>

        {scanError ? <Text style={styles.scanErrorText}>{scanError} Tap a button to try again.</Text> : null}

        <Button title="Take Photo" onPress={handleCapture} loading={launching} style={{ marginTop: Spacing.lg, alignSelf: "stretch" }} />
        <Pressable onPress={handlePickFromLibrary} disabled={launching} style={styles.libraryLink}>
          <Ionicons name="images-outline" size={15} color={Color.gold} />
          <Text style={styles.libraryLinkText}>Upload a photo or screenshot instead</Text>
        </Pressable>
      </View>

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
  scanErrorText: { textAlign: "center", fontSize: 12, color: Color.danger, marginTop: Spacing.sm, paddingHorizontal: Spacing.xl },
  libraryLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: Spacing.md },
  libraryLinkText: { fontSize: 13, fontWeight: "600", color: Color.gold },
  manualLink: { alignItems: "center", paddingVertical: Spacing.lg },
  manualLinkText: { fontSize: 13, color: Color.gold, fontWeight: "600" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  itemCard: { padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  itemCardExcluded: { opacity: 0.5 },
  itemHeaderRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  checkbox: { padding: 2 },
  nameInput: { flex: 1, fontSize: 14, fontWeight: "700", color: Color.textPrimary, paddingVertical: 4 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badgeGroup: { flexDirection: "row", gap: 6 },
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
  itemFooter: {
    marginTop: 2,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
    gap: 6,
  },
  footerLink: { alignItems: "flex-start" },
  footerLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  footerLinkQuiet: { alignItems: "flex-start" },
  footerLinkQuietText: { fontSize: 11, fontWeight: "500", color: Color.textFaint },
  correctionWrap: {
    marginTop: 2,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    gap: Spacing.xs,
  },
  correctionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  correctionHeaderText: { fontSize: 11, fontWeight: "700", color: Color.gold },
  correctionInput: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  correctionActions: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.md, alignItems: "center" },
  correctionCancel: { paddingVertical: 4 },
  correctionSubmit: { paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: Radius.pill, backgroundColor: Color.gold },
  correctionSubmitText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
  retakeLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: Spacing.md },
  retakeLinkText: { fontSize: 13, fontWeight: "600", color: Color.gold },
  manualLinkQuiet: { alignItems: "center", paddingVertical: Spacing.sm },
  manualLinkQuietText: { fontSize: 12, fontWeight: "500", color: Color.textFaint },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xl },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm, textAlign: "center" },
});
