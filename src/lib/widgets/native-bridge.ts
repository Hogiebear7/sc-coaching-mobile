import type { WidgetSnapshot, WidgetWaterTaps } from "@/lib/widgets/snapshot";
import type { ClassActivityState, WorkoutActivityState } from "@/lib/widgets/live-activity";

// What the app tells the home-screen widgets and Live Activities. This file is the version for platforms without them (web, tests); the
// real ones are native-bridge.ios.ts and native-bridge.android.ts, picked by the bundler. Every call is best-effort and never throws.

export interface NativeBridge {
  /** Hands the widgets their latest data. `taps` is what the widget's own water button has added today, so it keeps counting from there. */
  updateHomeWidgets(snapshot: WidgetSnapshot, taps: WidgetWaterTaps | null): Promise<void>;
  /** What the water widget's button has added (its running total for the day), or null. */
  readWidgetWaterTaps(): Promise<WidgetWaterTaps | null>;
  /** Shows, updates or (with null) ends the workout Live Activity / Live Update. */
  setWorkoutActivity(state: WorkoutActivityState | null, glass: boolean): Promise<void>;
  /** Shows, updates or (with null) ends the class countdown. */
  setClassActivity(state: ClassActivityState | null, glass: boolean): Promise<void>;
}

export const nativeBridge: NativeBridge = {
  async updateHomeWidgets(snapshot) {
    // No widgets here (web, tests); say what they would have got, so the update path can be checked in the browser preview.
    console.log(`[widgets] (no widgets on this platform) update: water ${snapshot.water ? "yes" : "no"}, nutrition ${snapshot.nutrition ? "yes" : "no"}, classes ${snapshot.classes ? "yes" : "no"}`);
  },
  async readWidgetWaterTaps() {
    return null;
  },
  async setWorkoutActivity() {},
  async setClassActivity() {},
};
