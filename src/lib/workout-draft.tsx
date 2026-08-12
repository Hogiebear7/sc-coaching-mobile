import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";

import type { WorkoutSetType } from "@/lib/queries/workouts";

const STORAGE_KEY = "workout-draft-v1";
const LIVE_NOTIFICATION_ID = "workout-draft-live";

export type SetRow = { key: string; weight: string; reps: string; setType: WorkoutSetType; completed: boolean };

export type ExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  notes: string;
  rir: string;
  setRows: SetRow[];
  unitMode: "weight" | "time";
  defaultSetType: WorkoutSetType;
  supersetWithPrev: boolean;
};

export type RunRow = {
  key: string;
  distance: string;
  distanceUnit: "km" | "m";
  duration: string;
  reps: string;
  sets: string;
  notes: string;
  splits: string[];
};

export type WorkoutFormat = "standard" | "circuit" | "amrap" | "emom" | "tabata" | "chipper";

export type CircuitStation = { key: string; name: string; mode: "reps" | "time"; reps: string; seconds: string };

export interface CircuitConfig {
  stations: CircuitStation[];
  restBetweenStationsSecs: string;
  restBetweenSetsSecs: string;
  capMode: "sets" | "time";
  totalSets: string;
  timeCapMins: string;
}

export interface AmrapConfig {
  timeCapMins: string;
  movements: string[];
  roundsCompleted: string;
  extraReps: string;
}

export interface EmomConfig {
  intervalSecs: string;
  totalMins: string;
  movements: string[];
}

export interface TabataConfig {
  workSecs: string;
  restSecs: string;
  rounds: string;
  movements: string[];
}

function emptyCircuitConfig(): CircuitConfig {
  return {
    stations: [],
    restBetweenStationsSecs: "15",
    restBetweenSetsSecs: "60",
    capMode: "sets",
    totalSets: "3",
    timeCapMins: "20",
  };
}

function emptyAmrapConfig(): AmrapConfig {
  return { timeCapMins: "12", movements: [], roundsCompleted: "", extraReps: "" };
}

function emptyEmomConfig(): EmomConfig {
  return { intervalSecs: "60", totalMins: "10", movements: [] };
}

function emptyTabataConfig(): TabataConfig {
  return { workSecs: "20", restSecs: "10", rounds: "8", movements: [] };
}

export interface WorkoutDraft {
  title: string;
  date: string;
  durationMins: string;
  notes: string;
  exerciseRows: ExerciseRow[];
  runRows: RunRow[];
  seeded: boolean;
  isLive: boolean;
  // Timer is timestamp-based (not a running counter) so elapsed time stays
  // correct across the app being backgrounded or this screen unmounting —
  // a setInterval counter would stall the moment the JS thread suspends.
  accumulatedSecs: number;
  startedAtMs: number | null;
  format: WorkoutFormat;
  circuitConfig: CircuitConfig;
  amrapConfig: AmrapConfig;
  emomConfig: EmomConfig;
  tabataConfig: TabataConfig;
  formatResultNote: string;
}

function emptyDraft(): WorkoutDraft {
  return {
    title: "",
    date: "",
    durationMins: "",
    notes: "",
    exerciseRows: [],
    runRows: [],
    seeded: false,
    isLive: false,
    accumulatedSecs: 0,
    startedAtMs: null,
    format: "standard",
    circuitConfig: emptyCircuitConfig(),
    amrapConfig: emptyAmrapConfig(),
    emomConfig: emptyEmomConfig(),
    tabataConfig: emptyTabataConfig(),
    formatResultNote: "",
  };
}

async function scheduleLiveNotification(elapsedSecs: number): Promise<void> {
  if (Platform.OS === "web") return;
  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_NOTIFICATION_ID,
      content: {
        title: "Workout in progress",
        body: `${mins}:${String(secs).padStart(2, "0")} elapsed — tap to return to your session.`,
        data: { linkHref: "/log-workout" },
        sticky: true,
      },
      trigger: null,
    });
  } catch {
    // Best-effort — a missing permission shouldn't block the workout itself.
  }
}

async function clearLiveNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.dismissNotificationAsync(LIVE_NOTIFICATION_ID);
    await Notifications.cancelScheduledNotificationAsync(LIVE_NOTIFICATION_ID);
  } catch {
    // Best-effort.
  }
}

interface WorkoutDraftContextValue {
  draft: WorkoutDraft;
  hydrated: boolean;
  hasContent: boolean;
  update: (patch: Partial<WorkoutDraft>) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  discard: () => void;
  elapsedSecsNow: () => number;
}

const WorkoutDraftContext = createContext<WorkoutDraftContextValue | null>(null);

export function WorkoutDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<WorkoutDraft>(emptyDraft());
  const [hydrated, setHydrated] = useState(false);
  const notificationTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load any draft left over from a previous session (app was killed mid-workout).
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setDraft({ ...emptyDraft(), ...JSON.parse(raw) });
      } catch {
        // Corrupt/unreadable draft — start fresh rather than crash.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist on every change, once initial hydration is done (avoids
  // immediately overwriting a just-loaded draft with the pre-load empty one).
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft)).catch(() => {});
  }, [draft, hydrated]);

  function elapsedSecsNow(): number {
    if (!draft.startedAtMs) return draft.accumulatedSecs;
    return draft.accumulatedSecs + Math.floor((Date.now() - draft.startedAtMs) / 1000);
  }

  // Keep the live notification's elapsed time roughly current while the
  // timer runs — refreshed periodically rather than every second, since the
  // notification tray doesn't need second-level precision and frequent
  // re-scheduling is wasted battery/work.
  useEffect(() => {
    if (!draft.startedAtMs) {
      if (notificationTickRef.current) clearInterval(notificationTickRef.current);
      return;
    }
    void scheduleLiveNotification(elapsedSecsNow());
    notificationTickRef.current = setInterval(() => {
      void scheduleLiveNotification(elapsedSecsNow());
    }, 60_000);
    return () => {
      if (notificationTickRef.current) clearInterval(notificationTickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.startedAtMs]);

  // Also refresh immediately when the app comes back from the background,
  // so the notification (and any UI reading elapsedSecsNow) doesn't show
  // stale time from before backgrounding.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && draft.startedAtMs) void scheduleLiveNotification(elapsedSecsNow());
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.startedAtMs, draft.accumulatedSecs]);

  const update = useCallback((patch: Partial<WorkoutDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const startTimer = useCallback(() => {
    setDraft((prev) => (prev.startedAtMs ? prev : { ...prev, startedAtMs: Date.now() }));
  }, []);

  const pauseTimer = useCallback(() => {
    setDraft((prev) => {
      if (!prev.startedAtMs) return prev;
      const elapsed = prev.accumulatedSecs + Math.floor((Date.now() - prev.startedAtMs) / 1000);
      return { ...prev, accumulatedSecs: elapsed, startedAtMs: null };
    });
    void clearLiveNotification();
  }, []);

  const resetTimer = useCallback(() => {
    setDraft((prev) => ({ ...prev, accumulatedSecs: 0, startedAtMs: null }));
    void clearLiveNotification();
  }, []);

  const discard = useCallback(() => {
    setDraft(emptyDraft());
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    void clearLiveNotification();
  }, []);

  const hasContent =
    draft.title.trim().length > 0 ||
    draft.exerciseRows.some((r) => r.name.trim()) ||
    draft.runRows.length > 0 ||
    draft.accumulatedSecs > 0 ||
    draft.startedAtMs !== null;

  const value = useMemo(
    () => ({ draft, hydrated, hasContent, update, startTimer, pauseTimer, resetTimer, discard, elapsedSecsNow }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, hydrated, hasContent, update, startTimer, pauseTimer, resetTimer, discard]
  );

  return <WorkoutDraftContext.Provider value={value}>{children}</WorkoutDraftContext.Provider>;
}

export function useWorkoutDraft(): WorkoutDraftContextValue {
  const ctx = useContext(WorkoutDraftContext);
  if (!ctx) throw new Error("useWorkoutDraft must be used within WorkoutDraftProvider");
  return ctx;
}
