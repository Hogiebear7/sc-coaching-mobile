import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestWidgetUpdate } from "react-native-android-widget";

import { ScLiveUpdate } from "../../../modules/sc-live-update";
import { ANDROID_WIDGET_NAMES, ClassWidgetAndroid, NutritionWidgetAndroid, WaterWidgetAndroid } from "@/widgets/android/home-widgets";
import { CLASS_LEAD_MINS, classChipText, clock, type ClassActivityState, type WorkoutActivityState } from "@/lib/widgets/live-activity";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";
import { readAndroidTaps } from "@/lib/widgets/widget-water";
import type { NativeBridge } from "./native-bridge";

// Android: App Widgets through react-native-android-widget, and Live Updates (status-bar chip, promoted notification) through the app's own
// small native module (modules/sc-live-update). See native-bridge.ts for the contract.

/** The latest snapshot, for the widget task handler to draw from when the launcher asks (src/widgets/android/task-handler.tsx). */
export const ANDROID_SNAPSHOT_KEY = "sc.widgetSnapshot";
const WORKOUT_ID = 7101;
const CLASS_ID = 7102;

export async function renderAndroidWidgets(snapshot: WidgetSnapshot) {
  const look = snapshot.style;
  const tasks: [string, () => ReturnType<typeof WaterWidgetAndroid>][] = [
    [ANDROID_WIDGET_NAMES.water, () => <WaterWidgetAndroid data={snapshot.water} look={look} />],
    [ANDROID_WIDGET_NAMES.nutrition, () => <NutritionWidgetAndroid data={snapshot.nutrition} look={look} />],
    [ANDROID_WIDGET_NAMES.nextClass, () => <ClassWidgetAndroid data={snapshot.classes} look={look} />],
  ];
  for (const [widgetName, render] of tasks) {
    try {
      await requestWidgetUpdate({ widgetName, renderWidget: render, widgetNotFound: () => console.log(`[widgets] ${widgetName}: none on the home screen`) });
      console.log(`[widgets] ${widgetName}: drawn`);
    } catch (error) {
      // Logged (visible in the phone's log as ReactNativeJS) so a widget that doesn't update can be diagnosed.
      console.warn(`[widgets] ${widgetName}: update failed`, String(error));
    }
  }
}

export const nativeBridge: NativeBridge = {
  async updateHomeWidgets(snapshot) {
    console.log(`[widgets] update: water ${snapshot.water ? "yes" : "no"}, nutrition ${snapshot.nutrition ? "yes" : "no"}, classes ${snapshot.classes ? "yes" : "no"}`);
    try {
      await AsyncStorage.setItem(ANDROID_SNAPSHOT_KEY, JSON.stringify(snapshot));
      await renderAndroidWidgets(snapshot);
    } catch (error) {
      // Widgets are never a reason for anything else to fail, but say why for diagnosis.
      console.warn("[widgets] update failed", String(error));
    }
  },

  async readWidgetWaterTaps() {
    return readAndroidTaps();
  },

  async setWorkoutActivity(state: WorkoutActivityState | null) {
    try {
      if (!ScLiveUpdate) return;
      if (!state) return ScLiveUpdate.dismiss(WORKOUT_ID);
      const now = Date.now();
      const resting = state.restEndsAtMs !== null && state.restEndsAtMs > now;
      const running = state.startedAtMs !== null;
      const countFrom = running ? state.startedAtMs! - state.accumulatedSecs * 1000 : 0;
      const parts = [`${state.setsDone} sets`];
      if (resting) parts.push("resting");
      else if (state.currentExercise) parts.push(state.currentExercise);
      ScLiveUpdate.show({
        id: WORKOUT_ID,
        title: state.title,
        text: parts.join(" · "),
        // Paused: the chip shows the still time. Running or resting: the system counts it (chronometer), so no per-second updates are sent.
        chip: running || resting ? "" : clock(state.accumulatedSecs),
        whenMs: resting ? state.restEndsAtMs! : countFrom,
        chronometer: running || resting,
        countDown: resting,
        progress: -1,
        uri: "sccoachingmobile://log-workout",
      });
    } catch {
      // Best-effort.
    }
  },

  async setClassActivity(state: ClassActivityState | null) {
    try {
      if (!ScLiveUpdate) return;
      if (!state) return ScLiveUpdate.dismiss(CLASS_ID);
      const now = Date.now();
      const d = new Date(state.startsAtMs);
      const at = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const elapsed = now - (state.startsAtMs - CLASS_LEAD_MINS * 60_000);
      ScLiveUpdate.show({
        id: CLASS_ID,
        title: state.title,
        text: now >= state.startsAtMs ? `Started at ${at}` : `Starts at ${at} · ${state.durationMins} min`,
        chip: now >= state.startsAtMs ? "Now" : classChipText(state, now),
        whenMs: state.startsAtMs,
        chronometer: now < state.startsAtMs,
        countDown: true,
        progress: Math.max(0, Math.min(100, Math.round((elapsed / (CLASS_LEAD_MINS * 60_000)) * 100))),
        uri: "sccoachingmobile://schedule",
      });
    } catch {
      // Best-effort.
    }
  },
};
