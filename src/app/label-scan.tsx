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

export default function LabelScanScreen() {
  const router = useRouter();
  const { barcode, date, mealType } = useLocalSearchParams<{ barcode?: string; date?: string; mealType?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const labelScan = useLabelScan();

  function goToManualForm(prefillSource?: string, extra?: Record<string, string>) {
    router.replace({
      pathname: "/custom-food",
      params: { barcode: barcode ?? "", date: date ?? "", mealType: mealType ?? "", prefillSource: prefillSource ?? "", ...extra },
    });
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    tapFeedback();
    setCapturing(true);
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo) throw new Error("No photo captured");

      const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1000 } }], { compress: 0.5, format: SaveFormat.JPEG, base64: true });
      if (!resized.base64) throw new Error("Could not encode photo");

      const imageBase64 = `data:image/jpeg;base64,${resized.base64}`;
      const res = await labelScan.mutateAsync(imageBase64);
      const fields = res.data.fields;

      goToManualForm("label_scan", {
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
      });
    } catch {
      // Most likely the OCR provider isn't configured yet (HTTP 501) — fall
      // back to the manual form with just the barcode carried over, rather
      // than dead-ending the flow.
      goToManualForm();
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
          <Pressable onPress={() => goToManualForm()} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>Enter this food manually instead</Text>
          </Pressable>
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

      {!barcode ? null : <Text style={styles.subhead}>Barcode not found — snap the nutrition label to create a custom food.</Text>}

      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} />
        {capturing || labelScan.isPending ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={Color.gold} size="large" />
            <Text style={styles.overlayText}>Reading label…</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.hint}>Fill the frame with the nutrition facts panel, then capture</Text>

      <Pressable onPress={handleCapture} disabled={capturing} style={styles.captureButton}>
        <View style={styles.captureButtonInner} />
      </Pressable>

      <Pressable onPress={() => goToManualForm()} style={styles.manualLink}>
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
  cameraWrap: { flex: 1, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Color.surface1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10,21,38,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  overlayText: { fontSize: 13, color: Color.textSecondary, textAlign: "center", marginTop: Spacing.sm },
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
