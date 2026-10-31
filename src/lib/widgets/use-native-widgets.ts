import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useSchedule } from "@/lib/queries/schedule";
import { classActivityActive, classStartMs, useLiveActivityPrefs, type ClassActivityState } from "@/lib/widgets/live-activity";
import { nativeBridge } from "@/lib/widgets/native-bridge";
import { localDate, mergeSnapshot, type WidgetSnapshot } from "@/lib/widgets/snapshot";
import { useWidgetSnapshot } from "@/lib/widgets/use-widget-snapshot";
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
  const busy = useRef(false);

  // Widgets: send widget water first (so the server's total includes it), then hand every widget the latest snapshot. The data loads a
  // moment after the app opens, so a change that arrives while an update is still running is never dropped: it runs again with the newest
  // snapshot once the current one finishes (otherwise the widgets kept the empty, "Open S&C to set up" version from before the data loaded).
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);
  const again = useRef(false);
  const shown = useRef<WidgetSnapshot | null>(null);
  useEffect(() => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    void (async () => {
      try {
        do {
          again.current = false;
          const taps = await nativeBridge.readWidgetWaterTaps();
          const sent = await sendWidgetWater(taps);
          if (sent > 0) {
            // The refreshed total comes back through the hydration query and runs this again with the right numbers.
            await qc.invalidateQueries({ queryKey: ["hydration", localDate(new Date())] });
            continue;
          }
          const next = mergeSnapshot(shown.current, latest.current);
          if (!(next.water || next.nutrition || next.classes)) console.log("[widgets] nothing loaded yet; waiting");
          if (next.water || next.nutrition || next.classes) {
            shown.current = next;
            await nativeBridge.updateHomeWidgets(next, taps);
          }
        } while (again.current);
      } finally {
        busy.current = false;
      }
    })();
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
