import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// Live Activities (iPhone: Dynamic Island and Lock Screen) and Live Updates (Android: status-bar chip and promoted notification). Owner request
// 2026-10-30. Designed to Apple's Human Interface Guidelines (Live Activities) and Android's Live Updates guidance:
//   - only for things the member started, that are happening now and have a clear end (both platforms' rule): a workout in progress, and a
//     class they booked once it is imminent (Android allows a future event only when imminent; calendar-style reminders are not allowed);
//   - only the essentials, in bold readable text; tapping opens the matching screen; ended as soon as the thing ends;
//   - each can be turned off here in the app (Apple: "make it easy for people to turn them off in your app").
// Plain data and rules here; the native presentations read the same state.

export const CLASS_LEAD_MINS = 60;
/** How long the class activity stays after the start time, so "Started" can be seen arriving (Apple: 15 to 30 minutes is usually enough). */
export const CLASS_LINGER_MINS = 15;

export interface WorkoutActivityState {
  title: string;
  /** When the timer last started (ms); null while paused. The platforms count the clock themselves, so no per-second updates are sent. */
  startedAtMs: number | null;
  /** Seconds already counted before the last start (pauses). */
  accumulatedSecs: number;
  setsDone: number;
  currentExercise: string | null;
  /** When the current rest ends (ms), or null when not resting. */
  restEndsAtMs: number | null;
}

export interface ClassActivityState {
  title: string;
  /** Local start time (ms). */
  startsAtMs: number;
  durationMins: number;
}

/** Elapsed workout seconds at `nowMs`. */
export function workoutElapsedSecs(s: WorkoutActivityState, nowMs: number): number {
  return s.accumulatedSecs + (s.startedAtMs !== null ? Math.max(0, Math.floor((nowMs - s.startedAtMs) / 1000)) : 0);
}

/** "12:05" or "1:02:05". */
export function clock(totalSecs: number): string {
  const s = Math.max(0, Math.floor(totalSecs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** Whether a booked class should show its countdown now: from CLASS_LEAD_MINS before the start until CLASS_LINGER_MINS after. */
export function classActivityActive(c: ClassActivityState, nowMs: number): boolean {
  return nowMs >= c.startsAtMs - CLASS_LEAD_MINS * 60_000 && nowMs < c.startsAtMs + CLASS_LINGER_MINS * 60_000;
}

/** The short text for the compact Dynamic Island and Android's status chip (Android shows it whole under 7 characters). */
export function classChipText(c: ClassActivityState, nowMs: number): string {
  const mins = Math.ceil((c.startsAtMs - nowMs) / 60_000);
  if (mins <= 0) return "Now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}

/** The booked class's local start time from its date and HH:MM. */
export function classStartMs(date: string, startTime: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = startTime.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

// ── The member's choices ──────────────────────────────────────────────────────────────────────────────────────────

export interface LiveActivityPrefs {
  workout: boolean;
  classCountdown: boolean;
}
export const DEFAULT_LIVE_ACTIVITY_PREFS: LiveActivityPrefs = { workout: true, classCountdown: true };
const STORAGE_KEY = "sc.liveActivityPrefs";

let current: LiveActivityPrefs = DEFAULT_LIVE_ACTIVITY_PREFS;
const listeners = new Set<() => void>();

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<LiveActivityPrefs>;
    current = { workout: p.workout !== false, classCountdown: p.classCountdown !== false };
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function setLiveActivityPrefs(next: LiveActivityPrefs) {
  current = { ...next };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

export function getLiveActivityPrefs(): LiveActivityPrefs {
  return current;
}

export function useLiveActivityPrefs(): LiveActivityPrefs {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}

// ── From the workout being logged ─────────────────────────────────────────────────────────────────────────────────

interface DraftLike {
  title: string;
  startedAtMs: number | null;
  accumulatedSecs: number;
  exerciseRows: { name: string; setRows: { completed: boolean }[] }[];
}

/**
 * The workout Live Activity's state from the workout being logged, or null when there's no timed workout (a workout only shows once its
 * timer has been started; logging a past workout without the timer never shows one). The current exercise is the first with a set still to
 * do, or the last one when every set is done.
 */
export function workoutActivityFromDraft(draft: DraftLike, restEndsAtMs: number | null): WorkoutActivityState | null {
  if (draft.startedAtMs === null && draft.accumulatedSecs <= 0) return null;
  const named = draft.exerciseRows.filter((r) => r.name.trim());
  const current = named.find((r) => r.setRows.some((s) => !s.completed)) ?? named[named.length - 1];
  return {
    title: draft.title.trim() || "Workout",
    startedAtMs: draft.startedAtMs,
    accumulatedSecs: draft.accumulatedSecs,
    setsDone: named.reduce((n, r) => n + r.setRows.filter((s) => s.completed).length, 0),
    currentExercise: current ? current.name.trim() : null,
    restEndsAtMs,
  };
}
