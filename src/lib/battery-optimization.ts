import { Linking, Platform } from "react-native";

// Android (only — iOS has no equivalent concept) can delay or silently drop
// a scheduled local notification — like the rest-timer alert — for an app
// it considers "optimized" for battery, especially a freshly-installed one.
// There's no way to grant the exemption silently; this just gets the member
// to the right settings screen in one tap instead of them having to hunt
// through Settings > Apps > [find app] > Battery themselves, which is what
// happened before this existed. IGNORE_BATTERY_OPTIMIZATION_SETTINGS is a
// stable AOSP intent action (since Android 6.0) that opens the "Battery
// optimization" app list directly — no extra native permission needed,
// unlike the one-tap "request exemption" dialog (REQUEST_IGNORE_BATTERY_
// OPTIMIZATIONS), which Play Store policy reserves for apps that can argue
// background execution is core to the app, not just a nice-to-have.
export async function openBatteryOptimizationSettings(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    await Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
    return true;
  } catch {
    return false;
  }
}

export function isBatteryOptimizationRelevant(): boolean {
  return Platform.OS === "android";
}
