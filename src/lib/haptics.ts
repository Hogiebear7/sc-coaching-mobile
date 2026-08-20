import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// No-ops on web (Haptics.impactAsync rejects there). Every tappable
// interactive element routes through these instead of calling the module
// directly, so web preview never needs its own guard. The .catch is
// belt-and-braces: an unhandled rejection here (e.g. hardware without a
// vibration motor, or a permission quirk on a given device) shouldn't be
// able to take the app down — haptic feedback is decoration, never a
// prerequisite for the action it's attached to.
export function tapFeedback() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function successFeedback() {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
