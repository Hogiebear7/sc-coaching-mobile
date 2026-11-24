// Pure helpers for the goals and rehab list: ids, validating what was saved, logging an entry, trimming old entries. No storage or phone APIs here,
// so it is all unit tested. The storage and reminder scheduling live in store.ts.

import type { Target, TargetEntry, TargetKind, TargetPeriod } from "./index";

export interface TargetsState {
  targets: Target[];
  entries: TargetEntry[];
}

export const EMPTY_STATE: TargetsState = { targets: [], entries: [] };

/** Entries older than this are dropped on save: the longest period shown is a month, so nothing older is needed. */
export const KEEP_ENTRY_DAYS = 45;

const PERIODS: TargetPeriod[] = ["day", "week", "month"];
const KINDS: TargetKind[] = ["goal", "rehab"];

export function newTargetId(now: Date = new Date(), random: () => number = Math.random): string {
  return `t-${now.getTime().toString(36)}-${Math.floor(random() * 36 ** 4).toString(36)}`;
}

function validTimes(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((t): t is string => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t));
  return out.length > 0 ? out : undefined;
}

function validTarget(v: unknown): Target | null {
  const t = v as Partial<Target> | null;
  if (!t || typeof t !== "object") return null;
  if (typeof t.id !== "string" || !t.id) return null;
  if (typeof t.title !== "string" || !t.title.trim()) return null;
  if (!KINDS.includes(t.kind as TargetKind) || !PERIODS.includes(t.period as TargetPeriod)) return null;
  if (typeof t.goalCount !== "number" || !Number.isFinite(t.goalCount) || t.goalCount <= 0) return null;
  const reminders = t.reminders;
  const times = validTimes(reminders?.times);
  const every =
    reminders?.every && typeof reminders.every.minutes === "number" && typeof reminders.every.start === "string" && typeof reminders.every.end === "string"
      ? reminders.every
      : undefined;
  const days = Array.isArray(t.days) ? t.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : undefined;
  return {
    id: t.id,
    kind: t.kind as TargetKind,
    title: t.title.trim().slice(0, 80),
    period: t.period as TargetPeriod,
    goalCount: t.goalCount,
    unit: typeof t.unit === "string" && t.unit.trim() ? t.unit.trim().slice(0, 24) : "times",
    days: days && days.length > 0 && days.length < 7 ? days : undefined,
    reminders: times || every ? { times, every } : undefined,
    active: t.active !== false,
    notes: typeof t.notes === "string" && t.notes.trim() ? t.notes.trim().slice(0, 400) : undefined,
    area: typeof t.area === "string" && t.area ? t.area : undefined,
  };
}

function validEntry(v: unknown): TargetEntry | null {
  const e = v as Partial<TargetEntry> | null;
  if (!e || typeof e.targetId !== "string" || typeof e.at !== "string" || typeof e.amount !== "number") return null;
  if (!Number.isFinite(e.amount) || Number.isNaN(new Date(e.at).getTime())) return null;
  return { targetId: e.targetId, at: e.at, amount: e.amount };
}

/** Turns whatever was saved (possibly old, damaged or empty) into a safe state. Never throws. */
export function parseState(raw: unknown): TargetsState {
  const r = raw as { targets?: unknown; entries?: unknown } | null;
  if (!r || typeof r !== "object") return EMPTY_STATE;
  const targets = (Array.isArray(r.targets) ? r.targets : []).map(validTarget).filter((t): t is Target => t !== null);
  const ids = new Set(targets.map((t) => t.id));
  const entries = (Array.isArray(r.entries) ? r.entries : []).map(validEntry).filter((e): e is TargetEntry => e !== null && ids.has(e.targetId));
  return { targets, entries };
}

/** Drops entries older than KEEP_ENTRY_DAYS. */
export function pruneEntries(entries: TargetEntry[], now: Date): TargetEntry[] {
  const cutoff = now.getTime() - KEEP_ENTRY_DAYS * 24 * 60 * 60 * 1000;
  return entries.filter((e) => new Date(e.at).getTime() >= cutoff);
}

/** Logs an amount against a target. A negative amount (an undo) is allowed but never takes today's total below zero in the display. */
export function addEntry(state: TargetsState, targetId: string, amount: number, now: Date): TargetsState {
  if (!state.targets.some((t) => t.id === targetId) || !Number.isFinite(amount) || amount === 0) return state;
  return { ...state, entries: pruneEntries([...state.entries, { targetId, at: now.toISOString(), amount }], now) };
}

/** Removes the most recent entry for a target (the "undo" button). */
export function undoLastEntry(state: TargetsState, targetId: string): TargetsState {
  let idx = -1;
  state.entries.forEach((e, i) => {
    if (e.targetId === targetId && (idx === -1 || new Date(e.at).getTime() >= new Date(state.entries[idx].at).getTime())) idx = i;
  });
  if (idx === -1) return state;
  return { ...state, entries: state.entries.filter((_, i) => i !== idx) };
}

export function upsertTarget(state: TargetsState, target: Target): TargetsState {
  const exists = state.targets.some((t) => t.id === target.id);
  return { ...state, targets: exists ? state.targets.map((t) => (t.id === target.id ? target : t)) : [...state.targets, target] };
}

/** Removes a target and its entries. */
export function removeTarget(state: TargetsState, id: string): TargetsState {
  return { targets: state.targets.filter((t) => t.id !== id), entries: state.entries.filter((e) => e.targetId !== id) };
}

/** The rehab plan is "active" when at least one rehab target is switched on. This is what shows the Train row and the Home card. */
export function hasActiveRehab(targets: Target[]): boolean {
  return targets.some((t) => t.kind === "rehab" && t.active);
}

/** Plain-English "5 of 10 reps today" style line. */
export function progressText(done: number, goal: number, unit: string, period: TargetPeriod): string {
  const when = period === "day" ? "today" : period === "week" ? "this week" : "this month";
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toString());
  return `${fmt(done)} of ${fmt(goal)} ${unit} ${when}`;
}

/** The one-tap "add" buttons on a goal, sized to the goal: +1 for a small count, bigger steps for 500 squats. */
export function quickAmounts(goalCount: number): number[] {
  if (goalCount <= 10) return [1];
  if (goalCount <= 50) return [1, 5];
  if (goalCount <= 200) return [5, 10, 25];
  return [10, 25, 50, 100];
}

/** A "10:00" style time for display, from "10:00" or "9:5"-like input. Bad input comes back as null. */
export function normaliseTime(value: string): string | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
