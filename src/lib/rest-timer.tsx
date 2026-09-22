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

function formatClockForNotification(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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

// Fires immediately alongside scheduleDoneNotification, sharing its
// identifier — so the moment the delayed "time's up" notification below
// actually presents, it replaces this one in the shade rather than
// stacking a second entry. `sticky` (Android-only; ignored on iOS) keeps
// it from being swiped away mid-rest, since it's meant to stay visible
// for the whole countdown, not just flash past.
async function scheduleStartNotification(seconds: number, label: string | null, setSummary: string | null): Promise<void> {
  if (Platform.OS === "web" || seconds <= 0) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: label ? `Resting — ${label}` : "Resting",
        body: setSummary
          ? `${setSummary} done. Back to it in ${formatClockForNotification(seconds)}.`
          : `Back to your next set in ${formatClockForNotification(seconds)}.`,
        sticky: true,
      },
      trigger: null,
    });
  } catch {
    // Best-effort.
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

// Every timer in the app — countdown or stopwatch — gets a 3-second "get
// ready" window before it actually starts counting, so a member who just
// tapped Start has a moment to get into position (grab the ropes, set up
// for a plank) before the clock they're being judged against begins. Only
// a genuinely FRESH start gets this: resuming an already-paused countdown,
// or a stopwatch that already has accumulated time, means the member is
// already mid-exercise and just paused briefly — there's nothing to get
// ready for, so those stay instant.
const PRE_COUNTDOWN_SECS = 3;

interface PendingStart {
  endsAtMs: number;
  kind: "countdown" | "stopwatch";
  countdownSecs?: number;
  label: string | null;
  setSummary?: string | null;
}

interface RestTimerContextValue {
  state: RestTimerState;
  hydrated: boolean;
  isRunning: boolean;
  isStopwatchRunning: boolean;
  /** True for the 3-second "get ready" window before a fresh start
   *  actually begins — see PRE_COUNTDOWN_SECS above. */
  isPreCountingDown: boolean;
  /** Whole seconds left in the pre-countdown (3, 2, 1, 0) — 0 when not
   *  pre-counting down. */
  preCountdownRemaining: () => number;
  remainingNow: () => number;
  stopwatchElapsedNow: () => number;
  /** Starts fresh at `seconds`. `setSummary` (e.g. "Set 3 60kg ×8") only
   *  affects the immediate start notification's body — it's not persisted
   *  in state. `getReady`: opt in to the 3-second get-ready window before
   *  the countdown actually begins — used by the "Start timer" button on a
   *  genuinely timed exercise, not by the auto-started rest between sets
   *  (nothing to physically get ready for there). Defaults to false. */
  start: (seconds: number, label?: string | null, setSummary?: string | null, getReady?: boolean) => void;
  /** Resumes from remainingAtPauseSecs — the play button on an already
   *  paused timer, as opposed to starting a new one. No get-ready window:
   *  the member was already mid-rest/mid-exercise. */
  resume: () => void;
  /** Also cancels a pending (not-yet-committed) fresh start. */
  pause: () => void;
  reset: (seconds: number, label?: string | null) => void;
  adjust: (deltaSecs: number) => void;
  /** Get-ready window applies only on a genuinely fresh start
   *  (stopwatchAccumulatedSecs === 0) — resuming a paused stopwatch is
   *  instant, same reasoning as countdown's resume(). */
  startStopwatch: (label?: string | null) => void;
  pauseStopwatch: () => void;
  resetStopwatch: (label?: string | null) => void;
  setMode: (mode: TimerMode) => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>(initialState());
  const [hydrated, setHydrated] = useState(false);
  // Ephemeral, never persisted — 3 seconds is far too short a window to
  // worry about surviving an app kill/restart; worst case the member just
  // taps Start again.
  const [pending, setPending] = useState<PendingStart | null>(null);

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

  const preCountdownRemaining = useCallback(() => {
    if (!pending) return 0;
    return Math.max(0, Math.ceil((pending.endsAtMs - Date.now()) / 1000));
  }, [pending]);

  const commitCountdownStart = useCallback((seconds: number, label: string | null, setSummary: string | null) => {
    const endsAtMs = Date.now() + seconds * 1000;
    setState((prev) => ({
      ...prev,
      mode: "countdown",
      label,
      durationSecs: seconds,
      endsAtMs,
      remainingAtPauseSecs: seconds,
    }));
    void scheduleStartNotification(seconds, label, setSummary);
    void scheduleDoneNotification(seconds, label);
  }, []);

  const commitStopwatchStart = useCallback((label: string | null) => {
    setState((prev) => ({ ...prev, mode: "stopwatch", label, stopwatchStartedAtMs: Date.now() }));
  }, []);

  // Fires the real start once the get-ready window elapses. A ref (not the
  // `pending` state itself) drives the actual setTimeout delay so a
  // re-render mid-countdown (e.g. from the ticking UI reading
  // preCountdownRemaining()) can't retrigger this effect and restart the
  // window from 3 again — it only ever depends on which PendingStart object
  // is active, not on time passing.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => {
      if (pending.kind === "countdown") commitCountdownStart(pending.countdownSecs ?? 0, pending.label, pending.setSummary ?? null);
      else commitStopwatchStart(pending.label);
      setPending(null);
    }, Math.max(0, pending.endsAtMs - Date.now()));
    return () => clearTimeout(id);
  }, [pending, commitCountdownStart, commitStopwatchStart]);

  // `getReady` is opt-in, not the default: resting between sets needs no
  // moment to prepare (there's nothing to physically set up for), so the
  // auto-started rest after a completed set starts immediately. A member
  // starting a genuinely timed EXERCISE (a plank, battle ropes) via the
  // dedicated "Start timer" button does ask for it explicitly — that's the
  // one call site that passes true.
  const start = useCallback(
    (seconds: number, label: string | null = null, setSummary: string | null = null, getReady: boolean = false) => {
      if (!getReady) {
        commitCountdownStart(seconds, label, setSummary);
        return;
      }
      setPending({
        endsAtMs: Date.now() + PRE_COUNTDOWN_SECS * 1000,
        kind: "countdown",
        countdownSecs: seconds,
        label,
        setSummary,
      });
    },
    [commitCountdownStart]
  );

  const resume = useCallback(() => {
    setState((prev) => {
      const remaining = prev.remainingAtPauseSecs > 0 ? prev.remainingAtPauseSecs : prev.durationSecs;
      const endsAtMs = Date.now() + remaining * 1000;
      void scheduleDoneNotification(remaining, prev.label);
      return { ...prev, endsAtMs, remainingAtPauseSecs: remaining };
    });
  }, []);

  const pause = useCallback(() => {
    setPending((p) => {
      if (p) return null; // cancel a pending fresh start instead of committing it
      return p;
    });
    setState((prev) => {
      if (prev.endsAtMs === null) return prev;
      const remaining = Math.max(0, Math.round((prev.endsAtMs - Date.now()) / 1000));
      return { ...prev, endsAtMs: null, remainingAtPauseSecs: remaining };
    });
    void cancelDoneNotification();
  }, []);

  const reset = useCallback((seconds: number, label: string | null = null) => {
    setPending((p) => (p?.kind === "countdown" ? null : p));
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
  const startStopwatch = useCallback(
    (label: string | null = null) => {
      if (state.stopwatchStartedAtMs !== null) return; // already running
      if (state.stopwatchAccumulatedSecs === 0) {
        // Genuinely fresh — get-ready window first.
        setPending({ endsAtMs: Date.now() + PRE_COUNTDOWN_SECS * 1000, kind: "stopwatch", label });
      } else {
        // Resuming after a pause — already mid-exercise, nothing to get
        // ready for, so this stays instant.
        setState((prev) => ({ ...prev, mode: "stopwatch", label, stopwatchStartedAtMs: Date.now() }));
      }
    },
    [state.stopwatchStartedAtMs, state.stopwatchAccumulatedSecs]
  );

  const pauseStopwatch = useCallback(() => {
    setPending((p) => (p?.kind === "stopwatch" ? null : p));
    setState((prev) => {
      if (prev.stopwatchStartedAtMs === null) return prev;
      const elapsed = prev.stopwatchAccumulatedSecs + Math.floor((Date.now() - prev.stopwatchStartedAtMs) / 1000);
      return { ...prev, stopwatchAccumulatedSecs: elapsed, stopwatchStartedAtMs: null };
    });
  }, []);

  const resetStopwatch = useCallback((label: string | null = null) => {
    setPending((p) => (p?.kind === "stopwatch" ? null : p));
    setState((prev) => ({ ...prev, mode: "stopwatch", label, stopwatchStartedAtMs: null, stopwatchAccumulatedSecs: 0 }));
  }, []);

  const setMode = useCallback((mode: TimerMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const isRunning = state.endsAtMs !== null;
  const isStopwatchRunning = state.stopwatchStartedAtMs !== null;

  const isPreCountingDown = pending !== null;

  const value = useMemo(
    () => ({
      state,
      hydrated,
      isRunning,
      isStopwatchRunning,
      isPreCountingDown,
      preCountdownRemaining,
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
      isPreCountingDown,
      preCountdownRemaining,
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
