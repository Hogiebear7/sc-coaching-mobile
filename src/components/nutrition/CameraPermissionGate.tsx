import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Color, Spacing } from "@/constants/theme";

// Shared across barcode-scan / label-scan / submit-food — the three camera
// entry points in the food-logging flow. Distinguishes "not asked yet /
// denied but askable" (re-prompt works) from "permanently denied"
// (re-prompting silently no-ops on iOS once the user has said no with
// "don't ask again" — the only way back is Settings). Getting this wrong
// strands a real-device user on a dead "Allow camera access" button with no
// visible next step, which is invisible in the web preview since browser
// permission prompts don't have that permanently-denied state.
export function CameraPermissionDenied({
  canAskAgain,
  requestPermission,
  message,
}: {
  canAskAgain: boolean;
  requestPermission: () => void;
  message: string;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="camera-outline" size={40} color={Color.textFaint} />
      <Text style={styles.text}>{message}</Text>
      {canAskAgain ? (
        <Button title="Allow camera access" onPress={requestPermission} style={{ marginTop: Spacing.lg }} />
      ) : (
        <>
          <Text style={styles.subtext}>Camera access is off for S&C Coaching. Turn it back on in your device Settings to continue.</Text>
          <Button title="Open Settings" onPress={() => Linking.openSettings()} style={{ marginTop: Spacing.lg }} />
        </>
      )}
    </View>
  );
}

// The camera preview itself can fail to start (hardware in use elsewhere,
// a device/emulator with no camera, a driver hiccup) — distinct from a
// permission problem, and worth a clearly different message so the member
// isn't told to check a Settings toggle that's already correct.
export function CameraUnavailable({ onFallback }: { onFallback: () => void }) {
  return (
    <View style={styles.overlay}>
      <Ionicons name="alert-circle-outline" size={32} color={Color.danger} />
      <Text style={styles.overlayText}>Camera unavailable right now. You can try again, or enter this food manually.</Text>
      <Button title="Enter manually" variant="secondary" onPress={onFallback} style={{ marginTop: Spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  text: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.md, lineHeight: 19 },
  subtext: { fontSize: 12, color: Color.textFaint, textAlign: "center", marginTop: Spacing.sm, lineHeight: 17 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10,21,38,0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  overlayText: { fontSize: 13, color: Color.textSecondary, textAlign: "center", marginTop: Spacing.sm, lineHeight: 19 },
});
