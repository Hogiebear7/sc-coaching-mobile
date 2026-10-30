import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { ANDROID_SNAPSHOT_KEY } from "@/lib/widgets/native-bridge.android";
import { localDate, type WidgetSnapshot } from "@/lib/widgets/snapshot";
import { recordAndroidTap, sendWidgetWater } from "@/lib/widgets/widget-water";
import { ANDROID_WIDGET_NAMES, ClassWidgetAndroid, NutritionWidgetAndroid, WaterWidgetAndroid } from "./home-widgets";

// Runs (headless, without the app open) when the launcher adds, updates or resizes an S&C widget, or when its water button is tapped. It
// draws from the last snapshot the app saved. A water tap counts on the widget at once and is sent to the server straight away; if that
// fails (no signal, signed out), the app sends it next time it opens, and never twice (lib/widgets/widget-water.ts).

async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(ANDROID_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

function render(props: WidgetTaskHandlerProps, snapshot: WidgetSnapshot | null) {
  const look = snapshot?.style ?? "navy";
  switch (props.widgetInfo.widgetName) {
    case ANDROID_WIDGET_NAMES.water:
      return props.renderWidget(<WaterWidgetAndroid data={snapshot?.water ?? null} look={look} />);
    case ANDROID_WIDGET_NAMES.nutrition:
      return props.renderWidget(<NutritionWidgetAndroid data={snapshot?.nutrition ?? null} look={look} />);
    case ANDROID_WIDGET_NAMES.nextClass:
      return props.renderWidget(<ClassWidgetAndroid data={snapshot?.classes ?? null} look={look} />);
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const snapshot = await readSnapshot();
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      render(props, snapshot);
      return;
    case "WIDGET_CLICK": {
      if (props.clickAction !== "ADD_WATER" || !snapshot?.water) return;
      const amountMl = Number(props.clickActionData?.amountMl) || snapshot.water.amountMl;
      const today = localDate(new Date());
      // A new day starts from 0 on the widget too.
      const loggedMl = (snapshot.water.date === today ? snapshot.water.loggedMl : 0) + amountMl;
      const next: WidgetSnapshot = { ...snapshot, water: { ...snapshot.water, date: today, loggedMl } };
      await AsyncStorage.setItem(ANDROID_SNAPSHOT_KEY, JSON.stringify(next));
      render(props, next);
      await sendWidgetWater(await recordAndroidTap(today, amountMl));
      return;
    }
    case "WIDGET_DELETED":
    default:
      return;
  }
}
