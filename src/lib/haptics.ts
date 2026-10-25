import AsyncStorage from "@react-native-async-storage/async-storage";
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
//
// Vocabulary (App v2): keep each kind for one job so the phone "speaks"
// consistently.
//   tapFeedback        light impact: buttons, rows, opening things
//   selectionFeedback  selection tick: tabs, segmented/range pills, pickers
//   impactFeedback     medium impact: the "+" button, starting a workout
//   successFeedback    success: a set/check-in/meal saved
//   celebrateFeedback  heavy impact: personal best
//   warningFeedback    warning: destructive confirm (discard, delete)
//   errorFeedback      error: a save failed
const STORAGE_KEY = "sc.hapticsEnabled";
let enabled = true;

AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (v === "false") enabled = false;
  })
  .catch(() => {});

export function hapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(on: boolean) {
  enabled = on;
  AsyncStorage.setItem(STORAGE_KEY, on ? "true" : "false").catch(() => {});
}

function run(fn: () => Promise<void> | undefined) {
  if (!enabled || Platform.OS === "web") return;
  try {
    fn()?.catch(() => {});
  } catch {
    // ignore — see comment above
  }
}

export function tapFeedback() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function selectionFeedback() {
  run(() => Haptics.selectionAsync());
}

export function impactFeedback() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function successFeedback() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function celebrateFeedback() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export function warningFeedback() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function errorFeedback() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
