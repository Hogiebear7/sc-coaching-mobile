import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch } from "@/lib/api-client";
import { waterToSync, type WidgetWaterTaps } from "@/lib/widgets/snapshot";

// Water added from a home-screen widget's button, sent to the server exactly once (lib/widgets/snapshot.ts waterToSync). The widget keeps a
// running total for the day; this remembers how much of it has been sent. Used by both platforms: the iPhone widget can't reach the server,
// so the app sends it next time it runs; the Android widget sends it straight from its click handler, and if that fails (no signal) the app
// sends the rest later.

const SYNCED_KEY = "sc.widgetWaterSynced";
/** Android keeps the widget's running total here (the iPhone widget keeps it in its own props). */
export const ANDROID_TAPS_KEY = "sc.widgetWaterTaps";

async function readSynced(): Promise<{ date: string; syncedMl: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(SYNCED_KEY);
    return raw ? (JSON.parse(raw) as { date: string; syncedMl: number }) : null;
  } catch {
    return null;
  }
}

/** Sends whatever the widget added that hasn't been sent. Returns the ml sent (0 when nothing was due or the send failed). */
export async function sendWidgetWater(taps: WidgetWaterTaps | null): Promise<number> {
  const due = waterToSync(taps, await readSynced());
  if (!due || !taps) return 0;
  try {
    await apiFetch("/api/mobile/hydration", { method: "POST", body: { date: due.date, deltaMl: due.deltaMl } });
    await AsyncStorage.setItem(SYNCED_KEY, JSON.stringify({ date: taps.date, syncedMl: taps.widgetAddedMl }));
    return due.deltaMl;
  } catch {
    return 0;
  }
}

export async function readAndroidTaps(): Promise<WidgetWaterTaps | null> {
  try {
    const raw = await AsyncStorage.getItem(ANDROID_TAPS_KEY);
    return raw ? (JSON.parse(raw) as WidgetWaterTaps) : null;
  } catch {
    return null;
  }
}

/** One tap on the Android widget's button: adds to today's running total (a new day starts again from 0). */
export async function recordAndroidTap(date: string, amountMl: number): Promise<WidgetWaterTaps> {
  const current = await readAndroidTaps();
  const next = { date, widgetAddedMl: (current && current.date === date ? current.widgetAddedMl : 0) + amountMl };
  await AsyncStorage.setItem(ANDROID_TAPS_KEY, JSON.stringify(next));
  return next;
}
