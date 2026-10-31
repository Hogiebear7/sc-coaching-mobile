import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useSchedule } from "@/lib/queries/schedule";
import { classActivityActive, classStartMs, useLiveActivityPrefs, type ClassActivityState } from "@/lib/widgets/live-activity";
import { nativeBridge } from "@/lib/widgets/native-bridge";
import { localDate, mergeSnapshot, type WidgetSnapshot } from "@/lib/widgets/snapshot";
import { useWidgetDataStatus, useWidgetSnapshot } from "@/lib/widgets/use-widget-snapshot";
import { sendWidgetWater } from "@/lib/widgets/widget-water";

// Keeps the home-screen widgets and the class countdown in step with the app, for a signed-in member (mounted once, in the root layout):
//   - whenever the water, food or booking data changes, and when the app comes back to the foreground, any water added from a widget's button
//     is sent (once), then every widget gets the latest numbers;
//   - the class countdown runs from an hour before a booked class until shortly after it starts, checked each minute while the app is open
//     and on every return to the foreground. (Starting it with the app closed would need the server to push it; not done yet.)
// Everything here is a no-op on web, where the bridge does nothing.

/** The booked class whose countdown should show now, if any. */
export function activeClass(bookings: { title: string; date: string; startTime: string; durationMins: number }[], nowMs: number): ClassActivityState | null {
  for (const b of bookings) {
    const state = { title: b.title, startsAtMs: classStartMs(b.date, b.startTime), durationMins: b.durationMins };
    if (classActivityActive(state, nowMs)) return state;
  }
  return null;
}

export function useNativeWidgets() {
  const qc = useQueryClient();
  const snapshot = useWidgetSnapshot();
  const prefs = useLiveActivityPrefs();
  const { data: schedule } = useSchedule();
  const [tick, setTick] = useState(0);
  // Widgets: each change (new data, the minute tick, a return to the app) queues one update, run strictly in order, so none is dropped and
  // none can get stuck behind another. An update sends any water added from a widget first (so the server's total includes it), then gives
  // every widget the newest numbers; a section still loading keeps what the widget last showed.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const shown = useRef<WidgetSnapshot | null>(null);
  const status = useWidgetDataStatus();
  useEffect(() => {
    const snap = snapshot;
    queue.current = queue.current
      .then(async () => {
        const taps = await nativeBridge.readWidgetWaterTaps();
        if ((await sendWidgetWater(taps)) > 0) {
          // The server's new total arrives through the hydration query, which queues another update with it.
          void qc.invalidateQueries({ queryKey: ["hydration", localDate(new Date())] });
        }
        const next = mergeSnapshot(shown.current, snap);
        if (!(next.water || next.nutrition || next.classes)) {
          console.log(`[widgets] nothing loaded yet (${status})`);
          return;
        }
        shown.current = next;
        await nativeBridge.updateHomeWidgets(next, taps);
      })
      .catch((error) => console.warn("[widgets] update failed", String(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, tick, qc]);

  // Class countdown.
  useEffect(() => {
    const state = prefs.classCountdown && schedule ? activeClass(schedule.upcomingBookings, Date.now()) : null;
    void nativeBridge.setClassActivity(state, snapshot.style === "glass");
  }, [schedule, prefs.classCountdown, snapshot.style, tick]);

  // A minute tick while open (the countdown's window opening and closing), and a refresh on every return to the foreground.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setTick((t) => t + 1);
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
}
