import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { lookupBarcode } from "@/lib/queries/food-catalog";

export default function BarcodeScanScreen() {
  const router = useRouter();
  const { date, mealType } = useLocalSearchParams<{ date?: string; mealType?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<"scanning" | "looking_up" | "error">("scanning");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scannedRef = useRef(false);

  async function handleScanned(result: BarcodeScanningResult) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    tapFeedback();
    setStatus("looking_up");

    try {
      const outcome = await lookupBarcode(result.data);
      if (outcome.found) {
        router.replace({
          pathname: "/log-food",
          params: { date: date ?? "", mealType: mealType ?? "", foodJson: encodeURIComponent(JSON.stringify(outcome.food)) },
        });
      } else {
        router.replace({ pathname: "/label-scan", params: { barcode: result.data, date: date ?? "", mealType: mealType ?? "" } });
      }
    } catch {
      setErrorMessage("Couldn't look up that barcode. Check your connection and try again.");
      setStatus("error");
    }
  }

  function retry() {
    scannedRef.current = false;
    setErrorMessage(null);
    setStatus("scanning");
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
          <Text style={styles.headerTitle}>Scan Barcode</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerFill}>
          <Ionicons name="barcode-outline" size={40} color={Color.textFaint} />
          <Text style={styles.permissionText}>S&C Coaching needs camera access to scan food barcodes.</Text>
          <Button title="Allow camera access" onPress={requestPermission} style={{ marginTop: Spacing.lg }} />
          <Pressable
            onPress={() => router.replace({ pathname: "/custom-food", params: { date: date ?? "", mealType: mealType ?? "" } })}
            style={styles.manualLink}
          >
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
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
          onBarcodeScanned={status === "scanning" ? handleScanned : undefined}
        />
        <View style={styles.frame} />

        {status === "looking_up" ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={Color.gold} size="large" />
            <Text style={styles.overlayText}>Looking up food…</Text>
          </View>
        ) : null}

        {status === "error" ? (
          <View style={styles.overlay}>
            <Ionicons name="alert-circle-outline" size={32} color={Color.danger} />
            <Text style={styles.overlayText}>{errorMessage}</Text>
            <Button title="Try again" onPress={retry} style={{ marginTop: Spacing.md }} />
          </View>
        ) : null}
      </View>

      <Text style={styles.hint}>Line up the barcode inside the frame</Text>
      <Pressable
        onPress={() => router.replace({ pathname: "/custom-food", params: { date: date ?? "", mealType: mealType ?? "" } })}
        style={styles.manualLink}
      >
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
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  permissionText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.md, lineHeight: 19 },
  cameraWrap: { flex: 1, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Color.surface1 },
  frame: {
    position: "absolute",
    top: "35%",
    left: "10%",
    right: "10%",
    height: "18%",
    borderWidth: 2,
    borderColor: Color.gold,
    borderRadius: Radius.md,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10,21,38,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  overlayText: { fontSize: 13, color: Color.textSecondary, textAlign: "center", marginTop: Spacing.sm, lineHeight: 19 },
  hint: { textAlign: "center", fontSize: 12, color: Color.textMuted, marginTop: Spacing.md },
  manualLink: { alignItems: "center", paddingVertical: Spacing.lg },
  manualLinkText: { fontSize: 13, color: Color.gold, fontWeight: "600" },
});
