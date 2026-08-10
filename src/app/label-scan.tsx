import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useLabelScan } from "@/lib/queries/food-catalog";

type Stage = "camera" | "confirming";

export default function LabelScanScreen() {
  const router = useRouter();
  const { barcode, date, mealType } = useLocalSearchParams<{ barcode?: string; date?: string; mealType?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [stage, setStage] = useState<Stage>("camera");
  const [capturing, setCapturing] = useState(false);
  const labelScan = useLabelScan();

  function goToManualForm(prefillSource: string, extra?: Record<string, string>) {
    router.replace({
      pathname: "/custom-food",
      params: { barcode: barcode ?? "", date: date ?? "", mealType: mealType ?? "", prefillSource, ...extra },
    });
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    tapFeedback();
    setCapturing(true);
    setStage("confirming");
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo) throw new Error("No photo captured");

      const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1000 } }], { compress: 0.5, format: SaveFormat.JPEG, base64: true });
      if (!resized.base64) throw new Error("Could not encode photo");

      const imageBase64 = `data:image/jpeg;base64,${resized.base64}`;

      let ocrFields: Record<string, string> = {};
      let prefillSource = "label_scan_fallback";
      try {
        const res = await labelScan.mutateAsync(imageBase64);
        const fields = res.data.fields;
        prefillSource = "label_scan_ocr";
        ocrFields = {
          name: fields.name ?? "",
          brandName: fields.brandName ?? "",
          calories: fields.calories !== null ? String(fields.calories) : "",
          proteinG: fields.proteinG !== null ? String(fields.proteinG) : "",
          carbsG: fields.carbsG !== null ? String(fields.carbsG) : "",
          fatG: fields.fatG !== null ? String(fields.fatG) : "",
          fiberG: fields.fiberG !== null ? String(fields.fiberG) : "",
          sugarG: fields.sugarG !== null ? String(fields.sugarG) : "",
          sodiumMg: fields.sodiumMg !== null ? String(fields.sodiumMg) : "",
          saturatedFatG: fields.saturatedFatG !== null ? String(fields.saturatedFatG) : "",
          servingLabel: fields.servingLabel ?? "",
          servingGrams: fields.servingGrams !== null ? String(fields.servingGrams) : "",
        };
      } catch {
        // Automatic reading isn't configured yet (HTTP 501) — this is the
        // expected, honest MVP path: the photo was still captured
        // successfully, it just needs a human to transcribe it. Carry the
        // photo through either way so it isn't wasted.
      }

      // capturedLabelPhoto is consumed by custom-food.tsx to cache the photo
      // for later reuse if the member chooses to share this food publicly.
      goToManualForm(prefillSource, { ...ocrFields, capturedLabelPhoto: imageBase64 });
    } catch {
      goToManualForm("label_scan_capture_failed");
    } finally {
      setCapturing(false);
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
          <Text style={styles.headerTitle}>Scan Label</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerFill}>
          <Ionicons name="camera-outline" size={40} color={Color.textFaint} />
          <Text style={styles.permissionText}>S&C Coaching needs camera access to scan nutrition labels.</Text>
          <Button title="Allow camera access" onPress={requestPermission} style={{ marginTop: Spacing.lg }} />
          <Pressable onPress={() => goToManualForm("label_scan_no_permission")} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>Enter this food manually instead</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === "confirming") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="checkmark" size={28} color={Color.goldForeground} />
          </View>
          <Text style={styles.confirmTitle}>Photo captured</Text>
          <Text style={styles.confirmText}>
            {labelScan.isPending ? "Reading the label…" : "Add a few details below and this food is ready to log."}
          </Text>
          {labelScan.isPending ? <ActivityIndicator color={Color.gold} size="small" style={{ marginTop: Spacing.md }} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Nutrition Label</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={styles.subhead}>
        {barcode
          ? "Couldn't find that barcode — photograph the nutrition facts panel to create this food."
          : "Photograph the nutrition facts panel to create this food."}
      </Text>

      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} />
        <View style={styles.frame} />
      </View>

      <Text style={styles.hint}>Fill the frame with the nutrition facts panel, then capture</Text>

      <Pressable onPress={handleCapture} disabled={capturing} style={styles.captureButton}>
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
  permissionText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.md, lineHeight: 19 },
  confirmIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.md },
  confirmText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  cameraWrap: { flex: 1, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Color.surface1 },
  frame: {
    position: "absolute",
    top: "20%",
    left: "8%",
    right: "8%",
    bottom: "20%",
    borderWidth: 2,
    borderColor: Color.gold,
    borderRadius: Radius.md,
  },
  hint: { textAlign: "center", fontSize: 12, color: Color.textMuted, marginTop: Spacing.md },
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
});
