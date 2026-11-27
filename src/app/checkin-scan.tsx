import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type CameraMountError } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraPermissionDenied, CameraUnavailable } from "@/components/nutrition/CameraPermissionGate";
import { Button } from "@/components/ui/Button";
import { Radius, Spacing } from "@/constants/theme";
import { ApiError, apiFetch } from "@/lib/api-client";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Scan the code at the gym to check in to the class you have booked. The gym decides whether this is on (the button only shows where it is); the server decides what a scan does.
type Result = { ok: boolean; message: string };

export default function CheckinScanScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const handledRef = useRef(false);

  async function onScanned(scan: BarcodeScanningResult) {
    if (handledRef.current) return;
    handledRef.current = true;
    tapFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>("/api/mobile/checkin", { method: "POST", body: { code: scan.data } });
      successFeedback();
      setResult({ ok: true, message: res.message });
      // The check-in shows on Home, the schedule and the member's history.
      void queryClient.invalidateQueries();
    } catch (e) {
      setResult({ ok: false, message: e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function scanAgain() {
    handledRef.current = false;
    setResult(null);
  }

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle}>Check in</Text>
      <View style={{ width: 36 }} />
    </View>
  );

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
        {header}
        <CameraPermissionDenied canAskAgain={permission.canAskAgain} requestPermission={requestPermission} message="The app needs camera access to scan the check-in code at your gym." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {header}
      <View style={styles.cameraWrap}>
        {cameraUnavailable ? (
          <CameraUnavailable onFallback={() => router.back()} />
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={!result && !busy ? onScanned : undefined}
              onMountError={(_e: CameraMountError) => setCameraUnavailable(true)}
            />
            <View style={styles.frame} />
          </>
        )}

        {busy ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={Color.gold} size="large" />
            <Text style={styles.overlayText}>Checking you in…</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.overlay}>
            <Ionicons name={result.ok ? "checkmark-circle-outline" : "alert-circle-outline"} size={44} color={result.ok ? Color.gold : Color.danger} />
            <Text style={styles.resultText}>{result.message}</Text>
            {result.ok ? <Button title="Done" onPress={() => router.back()} style={{ marginTop: Spacing.md }} /> : <Button title="Try again" onPress={scanAgain} style={{ marginTop: Spacing.md }} />}
          </View>
        ) : null}
      </View>
      <Text style={styles.hint}>Point your phone at the check-in code at your gym</Text>
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
    cameraWrap: { flex: 1, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Color.surface1 },
    frame: { position: "absolute", top: "22%", left: "15%", right: "15%", aspectRatio: 1, borderWidth: 2, borderColor: Color.gold, borderRadius: Radius.md },
    overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(10,21,38,0.9)", alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
    overlayText: { fontSize: 14, color: Color.textSecondary, textAlign: "center", marginTop: Spacing.sm, lineHeight: 20 },
    resultText: { fontSize: 17, fontWeight: "600", color: Color.textPrimary, textAlign: "center", marginTop: Spacing.md, lineHeight: 24 },
    hint: { textAlign: "center", fontSize: 14, color: Color.textMuted, marginVertical: Spacing.md },
  })
);
