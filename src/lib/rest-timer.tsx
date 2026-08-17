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
// can't survive backgrounding, wall-clock math doesn't care. The stopwatch
// mode added alongside it follows the identical accumulated+startedAtMs
// pattern as workout-draft.tsx's own live-session timer.

const STORAGE_KEY = "rest-timer-v2";
const NOTIFICATION_ID = "rest-timer-done";

type TimerMode = "countdown" | "stopwatch";

interface RestTimerState {
  mode: TimerMode;
  /** The exercise this timer is running for, e.g. "Plank" — drives the
   *  screen title ("Countdown Timer — Plank"). Null for the generic
   *  rest-between-sets case, which stays plain "Rest Timer". */
  label: string | null;
  // Countdown fields.
  durationSecs: number;
  /** Set while running; the wall-clock instant the countdown reaches zero. */
  endsAtMs: number | null;
  /** Valid while paused (endsAtMs is null) — how much was left when paused. */
  remainingAtPauseSecs: number;
  // Stopwatch fields.
  stopwatchStartedAtMs: number | null;
  stopwatchAccumulatedSecs: number;
}

function initialState(): RestTimerState {
  return {
    mode: "countdown",
    label: null,
    durationSecs: 90,
    endsAtMs: null,
    remainingAtPauseSecs: 90,
    stopwatchStartedAtMs: null,
    stopwatchAccumulatedSecs: 0,
  };
}

async function scheduleDoneNotification(remainingSecs: number, label: string | null): Promise<void> {
  if (Platform.OS === "web" || remainingSecs <= 0) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: label ? `${label} — time's up` : "Rest complete",
        body: label ? "Countdown finished." : "Time for your next set.",
      },
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
  isStopwatchRunning: boolean;
  remainingNow: () => number;
  stopwatchElapsedNow: () => number;
  /** Starts fresh at `seconds` (running immediately). Used for auto-start
   *  on set-complete and for a deliberate preset/duration change. */
  start: (seconds: number, label?: string | null) => void;
  /** Resumes from remainingAtPauseSecs — the play button on an already
   *  paused timer, as opposed to starting a new one. */
  resume: () => void;
  pause: () => void;
  reset: (seconds: number, label?: string | null) => void;
  adjust: (deltaSecs: number) => void;
  startStopwatch: (label?: string | null) => void;
  pauseStopwatch: () => void;
  resetStopwatch: (label?: string | null) => void;
  setMode: (mode: TimerMode) => void;
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
          const parsed = JSON.parse(raw) as Partial<RestTimerState>;
          const merged = { ...initialState(), ...parsed };
          // A countdown that finished while the app was closed shouldn't
          // resurrect as "running" — land on paused-at-zero instead, same
          // as if the member had been there to see it complete.
          if (merged.endsAtMs !== null && merged.endsAtMs <= Date.now()) {
            setState({ ...merged, endsAtMs: null, remainingAtPauseSecs: 0 });
          } else {
            setState(merged);
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

  const stopwatchElapsedNow = useCallback(() => {
    if (state.stopwatchStartedAtMs === null) return state.stopwatchAccumulatedSecs;
    return state.stopwatchAccumulatedSecs + Math.floor((Date.now() - state.stopwatchStartedAtMs) / 1000);
  }, [state]);

  const start = useCallback((seconds: number, label: string | null = null) => {
    const endsAtMs = Date.now() + seconds * 1000;
    setState((prev) => ({
      ...prev,
      mode: "countdown",
      label,
      durationSecs: seconds,
      endsAtMs,
      remainingAtPauseSecs: seconds,
    }));
    void scheduleDoneNotification(seconds, label);
  }, []);

  const resume = useCallback(() => {
    setState((prev) => {
      const remaining = prev.remainingAtPauseSecs > 0 ? prev.remainingAtPauseSecs : prev.durationSecs;
      const endsAtMs = Date.now() + remaining * 1000;
      void scheduleDoneNotification(remaining, prev.label);
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

  const reset = useCallback((seconds: number, label: string | null = null) => {
    setState((prev) => ({ ...prev, mode: "countdown", label, durationSecs: seconds, endsAtMs: null, remainingAtPauseSecs: seconds }));
    void cancelDoneNotification();
  }, []);

  const adjust = useCallback((deltaSecs: number) => {
    setState((prev) => {
      if (prev.endsAtMs !== null) {
        const currentRemaining = Math.max(0, Math.round((prev.endsAtMs - Date.now()) / 1000));
        const nextRemaining = Math.max(0, currentRemaining + deltaSecs);
        void scheduleDoneNotification(nextRemaining, prev.label);
        return {
          ...prev,
          durationSecs: Math.max(0, prev.durationSecs + deltaSecs),
          endsAtMs: Date.now() + nextRemaining * 1000,
          remainingAtPauseSecs: nextRemaining,
        };
      }
      const nextRemaining = Math.max(0, prev.remainingAtPauseSecs + deltaSecs);
      return {
        ...prev,
        durationSecs: Math.max(0, prev.durationSecs + deltaSecs),
        endsAtMs: null,
        remainingAtPauseSecs: nextRemaining,
      };
    });
  }, []);

  // Stopwatch counts up with no target and never notifies on its own — it
  // only stops when the member says so — so unlike countdown, no scheduled
  // notification bookkeeping is needed at all.
  const startStopwatch = useCallback((label: string | null = null) => {
    setState((prev) => ({
      ...prev,
      mode: "stopwatch",
      label,
      stopwatchStartedAtMs: prev.stopwatchStartedAtMs ?? Date.now(),
    }));
  }, []);

  const pauseStopwatch = useCallback(() => {
    setState((prev) => {
      if (prev.stopwatchStartedAtMs === null) return prev;
      const elapsed = prev.stopwatchAccumulatedSecs + Math.floor((Date.now() - prev.stopwatchStartedAtMs) / 1000);
      return { ...prev, stopwatchAccumulatedSecs: elapsed, stopwatchStartedAtMs: null };
    });
  }, []);

  const resetStopwatch = useCallback((label: string | null = null) => {
    setState((prev) => ({ ...prev, mode: "stopwatch", label, stopwatchStartedAtMs: null, stopwatchAccumulatedSecs: 0 }));
  }, []);

  const setMode = useCallback((mode: TimerMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const isRunning = state.endsAtMs !== null;
  const isStopwatchRunning = state.stopwatchStartedAtMs !== null;

  const value = useMemo(
    () => ({
      state,
      hydrated,
      isRunning,
      isStopwatchRunning,
      remainingNow,
      stopwatchElapsedNow,
      start,
      resume,
      pause,
      reset,
      adjust,
      startStopwatch,
      pauseStopwatch,
      resetStopwatch,
      setMode,
    }),
    [
      state,
      hydrated,
      isRunning,
      isStopwatchRunning,
      remainingNow,
      stopwatchElapsedNow,
      start,
      resume,
      pause,
      reset,
      adjust,
      startStopwatch,
      pauseStopwatch,
      resetStopwatch,
      setMode,
    ]
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error("useRestTimer must be used within RestTimerProvider");
  return ctx;
}
