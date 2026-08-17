import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

// Rest timer state lives here, not in app/rest-timer.tsx, specifically so it
// survives the screen unmounting — which happens every time the member
// navigates away to log the next set, switch tabs, or background the app.
// The old screen-local version cancelled its notification on unmount,
// which meant the very first thing that happened after starting a rest
// timer and doing literally anything else silently killed the alert. A
// countdown is timestamp-based (endsAtMs), not a running counter, for the
// same reason app-wide as workout-draft.tsx's session timer: a setInterval
// can't survive backgrounding, wall-clock math doesn't care.

const STORAGE_KEY = "rest-timer-v1";
const NOTIFICATION_ID = "rest-timer-done";

interface RestTimerState {
  durationSecs: number;
  /** Set while running; the wall-clock instant the countdown reaches zero. */
  endsAtMs: number | null;
  /** Valid while paused (endsAtMs is null) — how much was left when paused. */
  remainingAtPauseSecs: number;
}

function initialState(): RestTimerState {
  return { durationSecs: 90, endsAtMs: null, remainingAtPauseSecs: 90 };
}

async function scheduleDoneNotification(remainingSecs: number): Promise<void> {
  if (Platform.OS === "web" || remainingSecs <= 0) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: { title: "Rest complete", body: "Time for your next set." },
      trigger: { seconds: remainingSecs, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
    });
  } catch {
    // Best-effort — a missing permission shouldn't block the timer itself.
  }
}

async function cancelDoneNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Best-effort.
  }
}

interface RestTimerContextValue {
  state: RestTimerState;
  hydrated: boolean;
  isRunning: boolean;
  remainingNow: () => number;
  /** Starts fresh at `seconds` (running immediately). Used for auto-start
   *  on set-complete and for a deliberate preset/duration change. */
  start: (seconds: number) => void;
  /** Resumes from remainingAtPauseSecs — the play button on an already
   *  paused timer, as opposed to starting a new one. */
  resume: () => void;
  pause: () => void;
  reset: (seconds: number) => void;
  adjust: (deltaSecs: number) => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>(initialState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as RestTimerState;
          // A timer that finished while the app was closed shouldn't
          // resurrect as "running" — land on paused-at-zero instead, same
          // as if the member had been there to see it complete.
          if (parsed.endsAtMs !== null && parsed.endsAtMs <= Date.now()) {
            setState({ durationSecs: parsed.durationSecs, endsAtMs: null, remainingAtPauseSecs: 0 });
          } else {
            setState(parsed);
          }
        }
      } catch {
        // Corrupt/unreadable state — start fresh rather than crash.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const remainingNow = useCallback(() => {
    if (state.endsAtMs === null) return state.remainingAtPauseSecs;
    return Math.max(0, Math.round((state.endsAtMs - Date.now()) / 1000));
  }, [state]);

  const start = useCallback((seconds: number) => {
    const endsAtMs = Date.now() + seconds * 1000;
    setState({ durationSecs: seconds, endsAtMs, remainingAtPauseSecs: seconds });
    void scheduleDoneNotification(seconds);
  }, []);

  const resume = useCallback(() => {
    setState((prev) => {
      const remaining = prev.remainingAtPauseSecs > 0 ? prev.remainingAtPauseSecs : prev.durationSecs;
      const endsAtMs = Date.now() + remaining * 1000;
      void scheduleDoneNotification(remaining);
      return { ...prev, endsAtMs, remainingAtPauseSecs: remaining };
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => {
      if (prev.endsAtMs === null) return prev;
      const remaining = Math.max(0, Math.round((prev.endsAtMs - Date.now()) / 1000));
      return { ...prev, endsAtMs: null, remainingAtPauseSecs: remaining };
    });
    void cancelDoneNotification();
  }, []);

  const reset = useCallback((seconds: number) => {
    setState({ durationSecs: seconds, endsAtMs: null, remainingAtPauseSecs: seconds });
    void cancelDoneNotification();
  }, []);

  const adjust = useCallback((deltaSecs: number) => {
    setState((prev) => {
      if (prev.endsAtMs !== null) {
        const currentRemaining = Math.max(0, Math.round((prev.endsAtMs - Date.now()) / 1000));
        const nextRemaining = Math.max(0, currentRemaining + deltaSecs);
        void scheduleDoneNotification(nextRemaining);
        return {
          durationSecs: Math.max(0, prev.durationSecs + deltaSecs),
          endsAtMs: Date.now() + nextRemaining * 1000,
          remainingAtPauseSecs: nextRemaining,
        };
      }
      const nextRemaining = Math.max(0, prev.remainingAtPauseSecs + deltaSecs);
      return {
        durationSecs: Math.max(0, prev.durationSecs + deltaSecs),
        endsAtMs: null,
        remainingAtPauseSecs: nextRemaining,
      };
    });
  }, []);

  const isRunning = state.endsAtMs !== null;

  const value = useMemo(
    () => ({ state, hydrated, isRunning, remainingNow, start, resume, pause, reset, adjust }),
    [state, hydrated, isRunning, remainingNow, start, resume, pause, reset, adjust]
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error("useRestTimer must be used within RestTimerProvider");
  return ctx;
}
