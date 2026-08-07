import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// No-ops on web (Haptics.impactAsync rejects there). Every tappable
// interactive element routes through these instead of calling the module
// directly, so web preview never needs its own guard.
export function tapFeedback() {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function successFeedback() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
