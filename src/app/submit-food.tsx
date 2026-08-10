import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type CameraCapturedPicture, type CameraMountError } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CameraPermissionDenied, CameraUnavailable } from "@/components/nutrition/CameraPermissionGate";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { getDraftLabelPhoto } from "@/lib/draft-photo-cache";
import { tapFeedback } from "@/lib/haptics";
import {
  getFoodSubmissionEligibility,
  useCreateSubmission,
  useMyCustomFoods,
  useMySubmissions,
  type FoodSubmissionStatus,
} from "@/lib/queries/food-catalog";
import { SUBMISSION_STATUS_COPY } from "@/lib/submission-status";

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  brandName: "Brand name",
  barcode: "Barcode",
};

const BLOCKING_STATUSES: FoodSubmissionStatus[] = ["pending_review", "approved", "submitted_to_open_food_facts"];

type CaptureSlot = "front" | "label";

function PhotoSlot({
  label,
  photoUri,
  onCapture,
  onClear,
}: {
  label: string;
  photoUri: string | null;
  onCapture: () => void;
  onClear: () => void;
}) {
  if (photoUri) {
    return (
      <View style={styles.photoSlotFilled}>
        <Text style={styles.photoSlotFilledText}>{label} added</Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={Color.textFaint} />
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable onPress={onCapture} style={styles.photoSlotEmpty}>
      <Ionicons name="camera-outline" size={16} color={Color.gold} />
      <Text style={styles.photoSlotEmptyText}>Add {label.toLowerCase()}</Text>
    </Pressable>
  );
}

export default function SubmitFoodScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: myFoods, isLoading: isLoadingFoods } = useMyCustomFoods();
  const { data: submissions, isLoading: isLoadingSubmissions } = useMySubmissions();
  const createSubmission = useCreateSubmission();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [consent, setConsent] = useState(false);
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [labelPhoto, setLabelPhoto] = useState<string | null>(null);
  const [captureSlot, setCaptureSlot] = useState<CaptureSlot | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const food = myFoods?.find((f) => f.id === id);
  const existingSubmission = submissions?.find((s) => s.customFoodId === id);
  const isBlocked = !!existingSubmission && BLOCKING_STATUSES.includes(existingSubmission.status);
  const eligibility = food ? getFoodSubmissionEligibility(food) : null;

  useEffect(() => {
    if (id) trackEvent("food_submission_started", { customFoodId: id });
  }, [id]);

  const trackedEligibleRef = useRef(false);
  useEffect(() => {
    if (eligibility?.eligibility === "eligible_for_submission" && !trackedEligibleRef.current) {
      trackedEligibleRef.current = true;
      trackEvent("food_submission_eligible", { customFoodId: id });
    }
  }, [eligibility, id]);

  const trackedRejectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (existingSubmission?.status === "rejected" && trackedRejectedRef.current !== existingSubmission.id) {
      trackedRejectedRef.current = existingSubmission.id;
      trackEvent("food_submission_rejected", { customFoodId: id });
    }
  }, [existingSubmission, id]);

  // If this food was created from a label-scan capture, offer that same
  // photo here instead of asking the member to photograph the label again.
  useEffect(() => {
    if (!id || labelPhoto) return;
    const draft = getDraftLabelPhoto(id);
    if (draft) setLabelPhoto(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleMountError(e: CameraMountError) {
    trackEvent("food_submission_camera_unavailable", { message: e.message });
    setCameraUnavailable(true);
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing || !captureSlot) return;
    tapFeedback();
    setCapturing(true);
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (!photo) throw new Error("No photo captured");
      const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1200 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
      if (!resized.base64) throw new Error("Could not encode photo");
      const dataUrl = `data:image/jpeg;base64,${resized.base64}`;
      if (captureSlot === "front") setFrontPhoto(dataUrl);
      else setLabelPhoto(dataUrl);
      setCaptureSlot(null);
    } catch {
      setError("Couldn't capture that photo — try again.");
    } finally {
      setCapturing(false);
    }
  }

  async function handleSubmit() {
    if (!food || !id) return;
    setError(null);
    if (!consent) {
      setError("You need to confirm consent before submitting.");
      return;
    }
    try {
      await createSubmission.mutateAsync({ customFoodId: id, consent: true, frontPhotoUrl: frontPhoto, labelPhotoUrl: labelPhoto });
      trackEvent("food_submission_sent", { customFoodId: id, hasFrontPhoto: !!frontPhoto, hasLabelPhoto: !!labelPhoto });
      tapFeedback();
      setJustSubmitted(true);
      setTimeout(() => router.back(), 700);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not submit this food. Please try again.");
    }
  }

  if (justSubmitted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="checkmark" size={28} color={Color.goldForeground} />
          </View>
          <Text style={styles.confirmTitle}>Submitted for review</Text>
          <Text style={styles.confirmText}>We'll let you know once a staff member has taken a look.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (captureSlot) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => setCaptureSlot(null)} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{captureSlot === "front" ? "Front of package" : "Nutrition label"}</Text>
          <View style={{ width: 22 }} />
        </View>
        {!permission?.granted ? (
          <CameraPermissionDenied
            canAskAgain={permission?.canAskAgain ?? true}
            requestPermission={requestPermission}
            message="Camera access is needed to add a photo."
          />
        ) : (
          <>
            <View style={styles.cameraWrap}>
              {cameraUnavailable ? (
                <CameraUnavailable onFallback={() => setCaptureSlot(null)} />
              ) : (
                <>
                  <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} onMountError={handleMountError} />
                  {capturing ? (
                    <View style={styles.overlay}>
                      <ActivityIndicator color={Color.gold} size="large" />
                    </View>
                  ) : null}
                </>
              )}
            </View>
            <Pressable onPress={handleCapture} disabled={capturing || cameraUnavailable} style={styles.captureButton}>
              <View style={styles.captureButtonInner} />
            </Pressable>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Submit to Open Food Facts</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoadingFoods || isLoadingSubmissions ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : !food ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t find that food.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.foodName}>{food.brandName ? `${food.brandName} — ${food.name}` : food.name}</Text>
          <Text style={styles.introText}>
            Sharing this food publicly helps other members find it by barcode. It stays private until you opt in, and a staff
            member reviews it before it goes live.
          </Text>

          {existingSubmission ? (
            <Card style={[styles.statusCard, { borderColor: Color[SUBMISSION_STATUS_COPY[existingSubmission.status].color] }]}>
              <Text style={[styles.statusLabel, { color: Color[SUBMISSION_STATUS_COPY[existingSubmission.status].color] }]}>
                {SUBMISSION_STATUS_COPY[existingSubmission.status].label}
              </Text>
              <Text style={styles.statusDetail}>{SUBMISSION_STATUS_COPY[existingSubmission.status].detail}</Text>
              {(existingSubmission.status === "rejected" || existingSubmission.status === "failed") && existingSubmission.reviewNote ? (
                <View style={styles.reviewNoteBox}>
                  <Text style={styles.reviewNoteLabel}>Note from our team</Text>
                  <Text style={styles.reviewNoteText}>{existingSubmission.reviewNote}</Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {!isBlocked && eligibility ? (
            <>
              <Text style={styles.sectionLabel}>ELIGIBILITY</Text>
              <Card style={styles.eligibilityCard}>
                {eligibility.eligibility === "eligible_for_submission" ? (
                  <View style={styles.eligibilityRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Color.success} />
                    <Text style={styles.eligibilityRowText}>This food has everything needed to submit.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.eligibilityBlockedText}>Add the following to this food before it can be submitted:</Text>
                    {eligibility.missingFields.map((field) => (
                      <View key={field} style={styles.eligibilityRow}>
                        <Ionicons name="close-circle-outline" size={16} color={Color.danger} />
                        <Text style={styles.eligibilityRowText}>{REQUIRED_FIELD_LABELS[field] ?? field}</Text>
                      </View>
                    ))}
                    <Pressable onPress={() => router.push({ pathname: "/custom-food", params: { id: food.id } })} style={styles.editLink}>
                      <Text style={styles.editLinkText}>Edit this food</Text>
                    </Pressable>
                  </>
                )}
              </Card>

              {eligibility.eligibility === "eligible_for_submission" ? (
                <>
                  <Text style={styles.sectionLabel}>PHOTOS (OPTIONAL)</Text>
                  <View style={styles.photoRow}>
                    <PhotoSlot label="Front photo" photoUri={frontPhoto} onCapture={() => setCaptureSlot("front")} onClear={() => setFrontPhoto(null)} />
                    <PhotoSlot label="Label photo" photoUri={labelPhoto} onCapture={() => setCaptureSlot("label")} onClear={() => setLabelPhoto(null)} />
                  </View>

                  <Pressable onPress={() => setConsent((c) => !c)} style={styles.consentRow}>
                    <Ionicons name={consent ? "checkbox" : "square-outline"} size={20} color={consent ? Color.gold : Color.textFaint} />
                    <Text style={styles.consentText}>
                      I confirm this information is accurate and consent to it being shared publicly via Open Food Facts.
                    </Text>
                  </Pressable>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <Button title="Submit for review" onPress={handleSubmit} loading={createSubmission.isPending} style={{ marginTop: Spacing.md }} />
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  confirmIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.md },
  confirmText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  foodName: { fontSize: 18, fontWeight: "700", color: Color.textPrimary },
  introText: { fontSize: 12, color: Color.textMuted, lineHeight: 18, marginTop: Spacing.xs, marginBottom: Spacing.md },
  statusCard: { padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md },
  statusLabel: { fontSize: 13, fontWeight: "700" },
  statusDetail: { fontSize: 12, color: Color.textMuted, marginTop: 4, lineHeight: 17 },
  reviewNoteBox: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  reviewNoteLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, color: Color.textFaint },
  reviewNoteText: { fontSize: 12, color: Color.textSecondary, marginTop: 3, lineHeight: 17 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  eligibilityCard: { padding: Spacing.md, marginBottom: Spacing.md },
  eligibilityRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: 6 },
  eligibilityRowText: { fontSize: 13, color: Color.textSecondary },
  eligibilityBlockedText: { fontSize: 12, color: Color.textMuted },
  editLink: { marginTop: Spacing.sm },
  editLinkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  photoRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  photoSlotEmpty: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    borderStyle: "dashed",
  },
  photoSlotEmptyText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  photoSlotFilled: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.success,
    paddingHorizontal: Spacing.sm,
  },
  photoSlotFilledText: { fontSize: 12, fontWeight: "600", color: Color.success },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginTop: Spacing.sm },
  consentText: { flex: 1, fontSize: 12, color: Color.textSecondary, lineHeight: 17 },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm },
  cameraWrap: { flex: 1, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Color.surface1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(10,21,38,0.85)", alignItems: "center", justifyContent: "center" },
  captureButton: {
    alignSelf: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: Color.gold,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.md,
  },
  captureButtonInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: Color.gold },
});
