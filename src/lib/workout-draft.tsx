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

export type SetRow = {
  key: string;
  weight: string;
  reps: string;
  repsRight: string;
  repsLeft: string;
  setType: WorkoutSetType;
  completed: boolean;
};

export type ExerciseRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  notes: string;
  rir: string;
  setRows: SetRow[];
  unitMode: "weight" | "time" | "band";
  defaultSetType: WorkoutSetType;
  /** "ST1", "ST2", etc. — exercises sharing a label were performed
      back-to-back as a superset. null = not part of one. */
  supersetGroup: string | null;
  /** Reps/weight performed per side (unilateral exercise). */
  perSide: boolean;
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

// Every circuit station always runs on a clock — reps-only stations with no
// time limit at all aren't a circuit, they're just an exercise list. repTarget
// is optional and shown alongside the time, for when a station still cares
// about hitting e.g. 15 reps inside that window.
export type CircuitStation = { key: string; name: string; seconds: string; repTarget: string };

export interface CircuitConfig {
  stations: CircuitStation[];
  restBetweenStationsSecs: string;
  restBetweenSetsSecs: string;
  capMode: "sets" | "time";
  totalSets: string;
  timeCapMins: string;
}

export type AmrapSubMode = "reps" | "rounds";

// "reps" mode: completedReps is the member's own count entered on the
// workout card once time's up — targetReps is unused. "rounds" mode:
// targetReps is the rep count that completes one round of this movement;
// completedReps accumulates live as they tap through their work, and the
// round count is derived (the minimum full-round completion across
// movements), not entered directly.
export type AmrapMovement = { key: string; name: string; targetReps: string; completedReps: number };

export interface AmrapConfig {
  timeCapMins: string;
  subMode: AmrapSubMode;
  movements: AmrapMovement[];
  // Legacy single-counter fields — still the source of truth for the result
  // summary text in "reps" mode where there's no natural per-movement round
  // count to derive from.
  roundsCompleted: string;
  extraReps: string;
}

export type EmomMovement = { key: string; name: string; repsOrTime: string };

export interface EmomConfig {
  intervalSecs: string;
  totalMins: string;
  movements: EmomMovement[];
}

export interface TabataConfig {
  workSecs: string;
  restSecs: string;
  rounds: string;
  movements: string[];
}

export type ChipperMovementMode = "reps" | "time";

/** One timestamped chip of progress against a movement — either a manual
    "+ Add" entry or a paused timer segment folded in. Kept in order, oldest
    first; this is what lets the eventual AI report see pacing within a
    chipper, not just the final total. */
export type ChipperLogEntry = { atMs: number; amount: number };

export type ChipperMovement = {
  key: string;
  name: string;
  mode: ChipperMovementMode;
  targetReps: string;
  /** Target duration in whole seconds, entered as mm:ss in the UI. */
  targetSeconds: string;
  doneReps: number;
  /** Seconds banked so far — from manual entry AND from any completed
      live-timer segments (a running segment's elapsed time is folded in
      here the moment it's paused, so this is always the source of truth). */
  doneSeconds: number;
  /** Timestamp the live countdown last resumed from, or null when paused/
      never started. Timestamp-based for the same reason the session timer
      is — stays correct across backgrounding. */
  timerStartedAtMs: number | null;
  log: ChipperLogEntry[];
};

export interface ChipperConfig {
  movements: ChipperMovement[];
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
  return { timeCapMins: "12", subMode: "reps", movements: [], roundsCompleted: "", extraReps: "" };
}

function emptyEmomConfig(): EmomConfig {
  return { intervalSecs: "60", totalMins: "10", movements: [] };
}

// Live state for the phase-based formats' "workout card" screen
// (circuit/EMOM/tabata share one engine; AMRAP and chipper track their own
// progress differently and don't use this). Timestamp-based — phaseStartedAtMs
// plus phaseElapsedAtPauseSecs, not a running counter — for the same reason
// every other live timer in this app is: a setInterval can't survive the
// screen unmounting or the app backgrounding, wall-clock math doesn't care.
// Lives in the draft (not a separate context) so it persists and resumes
// exactly like the rest of the session does.
export interface FormatSessionState {
  /** Has the member left the review ("workout card") screen and hit Start? */
  started: boolean;
  phaseIndex: number;
  phaseStartedAtMs: number | null;
  phaseElapsedAtPauseSecs: number;
  /** Whole-session elapsed, independent of any one phase — accumulates
   *  across phase transitions the same way phaseElapsedAtPauseSecs does
   *  within one phase. */
  totalElapsedAtPauseSecs: number;
  totalStartedAtMs: number | null;
}

function emptyFormatSession(): FormatSessionState {
  return {
    started: false,
    phaseIndex: 0,
    phaseStartedAtMs: null,
    phaseElapsedAtPauseSecs: 0,
    totalElapsedAtPauseSecs: 0,
    totalStartedAtMs: null,
  };
}

function emptyTabataConfig(): TabataConfig {
  return { workSecs: "20", restSecs: "10", rounds: "8", movements: [] };
}

function emptyChipperConfig(): ChipperConfig {
  return { movements: [] };
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
  chipperConfig: ChipperConfig;
  formatResultNote: string;
  formatSession: FormatSessionState;
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
    chipperConfig: emptyChipperConfig(),
    formatResultNote: "",
    formatSession: emptyFormatSession(),
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
