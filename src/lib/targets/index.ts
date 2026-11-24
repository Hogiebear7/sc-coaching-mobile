// The "targets" engine behind both goals (500 squats today, run 50 km this week, train 15 times this month) and rehab (do these exercises, N times a
// day). One target is a count to reach in a period, plus optional reminders. This file is the pure logic: progress, reminder times, and which reminders
// to schedule on the phone. Storage and screens come later.
//
// iOS keeps at most 64 scheduled local notifications for an app at any moment (not per day), so reminders are planned as a rolling window: the next
// few days only, soonest first, capped (default 60 to leave room for other notifications). The window is rebuilt whenever the app opens or a target
// changes. A member who does not open the app for several days can run out of scheduled reminders, which the screen should say plainly.

export type TargetPeriod = "day" | "week" | "month";
export type TargetKind = "goal" | "rehab";

export interface TargetReminders {
  /** Fixed times of day, "HH:MM" (24 hour). */
  times?: string[];
  /** Or every N minutes between start and end ("HH:MM"). */
  every?: { minutes: number; start: string; end: string };
}

export interface Target {
  id: string;
  kind: TargetKind;
  title: string;
  period: TargetPeriod;
  /** The count to reach each period (500 squats, 5 sessions, 3 times). */
  goalCount: number;
  /** What the count is of ("reps", "minutes", "km", "times"). */
  unit: string;
  /** Days of the week it applies to, 0 = Sunday. Empty or missing means every day. */
  days?: number[];
  reminders?: TargetReminders;
  active: boolean;
}

export interface TargetEntry {
  targetId: string;
  at: string;
  amount: number;
}

export interface PlannedReminder {
  targetId: string;
  at: Date;
  title: string;
  body: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The start (inclusive) and end (exclusive) of the period containing `now`. Weeks start on Monday. */
export function periodBounds(period: TargetPeriod, now: Date): { start: Date; end: Date } {
  const day = startOfDay(now);
  if (period === "day") return { start: day, end: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1) };
  if (period === "week") {
    const sinceMonday = (day.getDay() + 6) % 7;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - sinceMonday);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
  }
  return { start: new Date(day.getFullYear(), day.getMonth(), 1), end: new Date(day.getFullYear(), day.getMonth() + 1, 1) };
}

export function progressFor(target: Target, entries: TargetEntry[], now: Date): { done: number; goal: number; fraction: number; complete: boolean; remaining: number } {
  const { start, end } = periodBounds(target.period, now);
  const done = entries
    .filter((e) => e.targetId === target.id)
    .filter((e) => {
      const t = new Date(e.at).getTime();
      return t >= start.getTime() && t < end.getTime();
    })
    .reduce((sum, e) => sum + e.amount, 0);
  const goal = Math.max(1, target.goalCount);
  return { done, goal, fraction: Math.min(1, done / goal), complete: done >= goal, remaining: Math.max(0, goal - done) };
}

function parseHM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** The reminder times on one calendar day (empty when the target does not apply that day). */
export function reminderTimesOn(target: Target, day: Date): Date[] {
  if (target.days && target.days.length > 0 && !target.days.includes(day.getDay())) return [];
  const minutes = new Set<number>();
  for (const t of target.reminders?.times ?? []) {
    const m = parseHM(t);
    if (m !== null) minutes.add(m);
  }
  const every = target.reminders?.every;
  if (every && every.minutes >= 15) {
    const start = parseHM(every.start);
    const end = parseHM(every.end);
    if (start !== null && end !== null && end >= start) for (let m = start; m <= end; m += every.minutes) minutes.add(m);
  }
  const base = startOfDay(day);
  return [...minutes].sort((a, b) => a - b).map((m) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(m / 60), m % 60));
}

/**
 * Which reminders to schedule now: from `now` over the next `horizonDays` days, soonest first, at most `cap`. Today's remaining reminders are dropped
 * once a daily target is already complete.
 */
export function planReminders(targets: Target[], entries: TargetEntry[], now: Date, options: { horizonDays?: number; cap?: number } = {}): PlannedReminder[] {
  const horizon = options.horizonDays ?? 7;
  const cap = options.cap ?? 60;
  const out: PlannedReminder[] = [];
  for (const target of targets) {
    if (!target.active || !target.reminders) continue;
    const today = progressFor(target, entries, now);
    for (let d = 0; d < horizon; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      if (d === 0 && target.period === "day" && today.complete) continue;
      for (const at of reminderTimesOn(target, day)) {
        if (at.getTime() <= now.getTime()) continue;
        out.push({
          targetId: target.id,
          at,
          title: target.kind === "rehab" ? "Time for your rehab" : "Your goal",
          body: target.kind === "rehab" ? `${target.title}: ${target.goalCount} ${target.unit}` : `${target.title}: ${target.goalCount} ${target.unit} this ${target.period}`,
        });
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, cap);
}
