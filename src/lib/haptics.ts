import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// No-ops on web (Haptics.impactAsync rejects there). Every tappable
// interactive element routes through these instead of calling the module
// directly, so web preview never needs its own guard.
//
// Wrapped in try/catch, not just .catch() — a rejected promise is only
// half the failure mode. If the native module isn't linked/initialized for
// any reason, the call can throw synchronously instead of returning a
// promise at all, and a bare `.catch()` chained onto that call site would
// itself throw before ever reaching the .catch(). Haptic feedback is
// decoration, never a prerequisite for the action it's attached to, so
// nothing here should ever be able to take the app down.
export function tapFeedback() {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)?.catch(() => {});
  } catch {
    // ignore — see comment above
  }
}

export function successFeedback() {
  if (Platform.OS === "web") return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)?.catch(() => {});
  } catch {
    // ignore — see comment above
  }
}
