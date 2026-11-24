import { describe, expect, it } from "vitest";

import { periodBounds, planReminders, progressFor, reminderTimesOn, type Target } from "../index";

// Tuesday 24 Nov 2026, 10:00 local.
const NOW = new Date(2026, 10, 24, 10, 0);
const base: Target = { id: "t1", kind: "goal", title: "Squats", period: "day", goalCount: 500, unit: "reps", active: true };
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();

describe("periodBounds", () => {
  it("starts weeks on Monday and months on the 1st", () => {
    expect(periodBounds("week", NOW).start).toEqual(new Date(2026, 10, 23));
    expect(periodBounds("week", NOW).end).toEqual(new Date(2026, 10, 30));
    expect(periodBounds("month", NOW).start).toEqual(new Date(2026, 10, 1));
    expect(periodBounds("month", NOW).end).toEqual(new Date(2026, 11, 1));
    expect(periodBounds("day", NOW).start).toEqual(new Date(2026, 10, 24));
  });
});

describe("progressFor", () => {
  it("adds up this period's entries only", () => {
    const entries = [
      { targetId: "t1", at: at(24, 8), amount: 200 },
      { targetId: "t1", at: at(24, 9), amount: 150 },
      { targetId: "t1", at: at(23, 9), amount: 500 },
      { targetId: "other", at: at(24, 9), amount: 999 },
    ];
    const p = progressFor(base, entries, NOW);
    expect(p).toMatchObject({ done: 350, remaining: 150, complete: false });
    expect(p.fraction).toBeCloseTo(0.7);
  });

  it("counts a weekly target across the week and completes it", () => {
    const week: Target = { ...base, period: "week", goalCount: 5, unit: "sessions" };
    const entries = [23, 24, 25, 26, 27].map((d) => ({ targetId: "t1", at: at(d, 7), amount: 1 }));
    expect(progressFor(week, entries, new Date(2026, 10, 27, 12)).complete).toBe(true);
  });
});

describe("reminderTimesOn", () => {
  it("returns fixed times, sorted", () => {
    expect(reminderTimesOn({ ...base, reminders: { times: ["18:30", "08:00"] } }, NOW).map((d) => d.getHours() * 60 + d.getMinutes())).toEqual([480, 1110]);
  });

  it("returns every-N-minutes reminders inside the window", () => {
    const t = { ...base, reminders: { every: { minutes: 60, start: "09:00", end: "17:00" } } };
    expect(reminderTimesOn(t, NOW)).toHaveLength(9);
  });

  it("skips days the target does not apply to", () => {
    expect(reminderTimesOn({ ...base, days: [1, 3], reminders: { times: ["08:00"] } }, NOW)).toEqual([]);
    expect(reminderTimesOn({ ...base, days: [2], reminders: { times: ["08:00"] } }, NOW)).toHaveLength(1);
  });

  it("ignores bad times and intervals under 15 minutes", () => {
    expect(reminderTimesOn({ ...base, reminders: { times: ["25:00", "x"], every: { minutes: 5, start: "09:00", end: "10:00" } } }, NOW)).toEqual([]);
  });
});

describe("planReminders", () => {
  const hourly: Target = { ...base, reminders: { every: { minutes: 60, start: "09:00", end: "20:00" } } };

  it("only plans reminders still to come, soonest first", () => {
    const plan = planReminders([hourly], [], NOW, { horizonDays: 1 });
    expect(plan[0].at.getHours()).toBe(11);
    expect(plan.every((r) => r.at.getTime() > NOW.getTime())).toBe(true);
    expect(plan).toHaveLength(10);
  });

  it("never plans more than the cap, which keeps an hourly goal inside the iOS limit", () => {
    const many = [hourly, { ...hourly, id: "t2" }, { ...hourly, id: "t3" }];
    const plan = planReminders(many, [], NOW, { horizonDays: 14, cap: 60 });
    expect(plan).toHaveLength(60);
    expect(plan[0].at.getTime()).toBeLessThanOrEqual(plan[59].at.getTime());
  });

  it("drops today's remaining reminders once a daily target is done", () => {
    const entries = [{ targetId: "t1", at: at(24, 9), amount: 500 }];
    const plan = planReminders([hourly], entries, NOW, { horizonDays: 2 });
    expect(plan.every((r) => r.at.getDate() === 25)).toBe(true);
  });

  it("skips inactive targets and targets with no reminders, and words rehab reminders as rehab", () => {
    const rehab: Target = { ...base, id: "r1", kind: "rehab", title: "Ankle band work", goalCount: 3, unit: "sets", reminders: { times: ["12:00"] } };
    const plan = planReminders([{ ...hourly, active: false }, base, rehab], [], NOW, { horizonDays: 1 });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ targetId: "r1", title: "Time for your rehab" });
  });
});
