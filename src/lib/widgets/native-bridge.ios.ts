import type { LiveActivity } from "expo-widgets";

import { ClassWidget, NutritionWidget, WaterWidget, type WaterWidgetProps } from "@/widgets/ios/home-widgets.ios";
import { ClassActivity, WorkoutActivity, type ClassActivityProps, type WorkoutActivityProps } from "@/widgets/ios/live-activities.ios";
import { CLASS_LINGER_MINS, type ClassActivityState, type WorkoutActivityState } from "@/lib/widgets/live-activity";
import { describeClassTime, type WidgetSnapshot } from "@/lib/widgets/snapshot";
import type { NativeBridge } from "./native-bridge";

// iPhone: WidgetKit widgets and ActivityKit Live Activities through expo-widgets. See native-bridge.ts for the contract.

const WORKOUT_URL = "sccoachingmobile://log-workout";
const CLASS_URL = "sccoachingmobile://schedule";

let workout: LiveActivity<WorkoutActivityProps> | null = null;
let classActivity: LiveActivity<ClassActivityProps> | null = null;
let classKey: string | null = null;

function safe(run: () => void) {
  try {
    run();
  } catch {
    // Widgets are never a reason for anything else to fail.
  }
}

function workoutProps(s: WorkoutActivityState, glass: boolean): WorkoutActivityProps {
  const now = Date.now();
  const restEndsAtMs = s.restEndsAtMs && s.restEndsAtMs > now ? s.restEndsAtMs : 0;
  return {
    title: s.title,
    countFromMs: s.startedAtMs !== null ? s.startedAtMs - s.accumulatedSecs * 1000 : 0,
    pausedSecs: s.accumulatedSecs,
    setsDone: s.setsDone,
    currentExercise: s.currentExercise ?? "",
    restEndsAtMs,
    restTotalSecs: restEndsAtMs ? Math.max(1, Math.round((restEndsAtMs - now) / 1000)) : 0,
    glass,
  };
}

function classDetail(c: ClassActivityState): string {
  const d = new Date(c.startsAtMs);
  return `Starts at ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} · ${c.durationMins} min`;
}

export const nativeBridge: NativeBridge = {
  async updateHomeWidgets(snapshot: WidgetSnapshot, taps) {
    const glass = snapshot.style === "glass";
    safe(() => {
      const w = snapshot.water;
      const props: WaterWidgetProps = w
        ? {
            date: w.date,
            loggedMl: w.loggedMl,
            targetMl: w.targetMl ?? 0,
            amountMl: w.amountMl,
            widgetAddedMl: taps && taps.date === w.date ? taps.widgetAddedMl : 0,
            glass,
            empty: false,
          }
        : { date: "", loggedMl: 0, targetMl: 0, amountMl: 250, widgetAddedMl: 0, glass, empty: true };
      WaterWidget.updateSnapshot(props);
    });
    safe(() => {
      const n = snapshot.nutrition;
      NutritionWidget.updateSnapshot(
        n
          ? { calories: n.calories, targetCalories: n.targetCalories ?? 0, proteinG: n.proteinG, targetProteinG: n.targetProteinG ?? 0, glass, empty: false }
          : { calories: 0, targetCalories: 0, proteinG: 0, targetProteinG: 0, glass, empty: true }
      );
    });
    safe(() => {
      const c = snapshot.classes;
      ClassWidget.updateSnapshot(
        c
          ? {
              title: c.next?.title ?? "",
              when: c.next ? describeClassTime(c.next.date, c.next.startTime) : "",
              classesLeft: c.classesLeft ?? 0,
              hasClassesLeft: c.classesLeft !== null,
              canBook: c.canBook,
              glass,
              empty: false,
            }
          : { title: "", when: "", classesLeft: 0, hasClassesLeft: false, canBook: false, glass, empty: true }
      );
    });
  },

  async readWidgetWaterTaps() {
    try {
      const timeline = await WaterWidget.getTimeline();
      const latest = timeline[timeline.length - 1]?.props;
      return latest && latest.date ? { date: latest.date, widgetAddedMl: latest.widgetAddedMl } : null;
    } catch {
      return null;
    }
  },

  async setWorkoutActivity(state, glass) {
    try {
      workout ??= WorkoutActivity.getInstances()[0] ?? null;
      if (!state) {
        if (workout) await workout.end("immediate");
        workout = null;
        return;
      }
      const props = workoutProps(state, glass);
      if (workout) await workout.update(props);
      else workout = WorkoutActivity.start(props, WORKOUT_URL);
    } catch {
      workout = null;
    }
  },

  async setClassActivity(state, glass) {
    try {
      classActivity ??= ClassActivity.getInstances()[0] ?? null;
      const key = state ? `${state.title}@${state.startsAtMs}` : null;
      if (!state || (classActivity && classKey && key !== classKey)) {
        // Ended, or a different class: the old one goes now.
        if (classActivity) await classActivity.end("immediate");
        classActivity = null;
        classKey = null;
        if (!state) return;
      }
      const props: ClassActivityProps = { title: state.title, startsAtMs: state.startsAtMs, detail: classDetail(state), glass };
      const staleAt = new Date(state.startsAtMs + CLASS_LINGER_MINS * 60_000);
      if (classActivity) await classActivity.update(props, staleAt);
      else {
        // Marked stale once the class is under way; the app ends it when the countdown window closes (src/lib/widgets/use-native-widgets.ts).
        // It can't be ended ahead of time here: ending removes it from the Dynamic Island straight away.
        classActivity = ClassActivity.start(props, CLASS_URL, staleAt);
        classKey = key;
      }
    } catch {
      classActivity = null;
      classKey = null;
    }
  },
};
