import { describe, expect, it } from "vitest";

import { formatVolumeKg } from "../format-volume";
import type { ExerciseSection, WorkoutSessionSummary } from "../queries/workouts";
import { computeMuscleSetLevels, volumeShares } from "../workout-set-levels";

const TODAY = "2026-11-24";
const SECTIONS = new Map<string, ExerciseSection>([
  ["squat", "lower_push"],
  ["row", "upper_pull"],
  ["bench", "upper_push"],
  ["pushup", "upper_push"],
]);

function session(date: string, exercises: { id: string; weight: string | null; reps: number; sets: number }[]): WorkoutSessionSummary {
  return {
    id: `s-${date}`,
    date,
    title: "x",
    exercises: exercises.map((e) => ({ exerciseId: e.id, name: e.id, weight: e.weight, reps: e.reps, sets: e.sets, notes: null })),
  } as unknown as WorkoutSessionSummary;
}

describe("volumeShares", () => {
  it("adds up to exactly 100", () => {
    const shares = volumeShares([1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(volumeShares([20000, 80000])).toEqual([20, 80]);
  });
  it("is all zeros when there is no volume and never gives a share to a group with none", () => {
    expect(volumeShares([0, 0, 0])).toEqual([0, 0, 0]);
    expect(volumeShares([0, 1, 1]).slice(0, 1)).toEqual([0]);
  });
});

describe("computeMuscleSetLevels: volume and share", () => {
  const sessions = [
    session("2026-11-23", [
      { id: "squat", weight: "100", reps: 10, sets: 2 }, // 2000
      { id: "row", weight: "50", reps: 10, sets: 4 }, // 2000
      { id: "bench", weight: "80", reps: 5, sets: 4 }, // 1600
    ]),
  ];

  it("gives each group its volume in kg and its share of the total, adding to 100", () => {
    const r = computeMuscleSetLevels(sessions, SECTIONS, 7, TODAY);
    expect(r.totalVolumeKg).toBe(5600);
    expect(r.levels.lower_push).toMatchObject({ volumeKg: 2000, totalSets: 2 });
    expect(r.levels.upper_pull.volumeKg).toBe(2000);
    expect(r.levels.upper_push.volumeKg).toBe(1600);
    const total = Object.values(r.levels).reduce((s, l) => s + l.volumeSharePct, 0);
    expect(total).toBe(100);
    expect([r.levels.lower_push.volumeSharePct, r.levels.upper_pull.volumeSharePct, r.levels.upper_push.volumeSharePct]).toEqual([36, 36, 28]);
    expect(r.levels.core.volumeSharePct).toBe(0);
  });

  it("leaves bodyweight-only sets out of volume but still counts their sets", () => {
    const r = computeMuscleSetLevels([session("2026-11-23", [{ id: "pushup", weight: "BW", reps: 20, sets: 3 }])], SECTIONS, 7, TODAY);
    expect(r.levels.upper_push).toMatchObject({ totalSets: 3, volumeKg: 0, volumeSharePct: 0 });
    expect(r.totalVolumeKg).toBe(0);
  });
});

describe("computeMuscleSetLevels: windows", () => {
  const old = session("2026-08-24", [{ id: "squat", weight: "100", reps: 10, sets: 3 }]); // 3000, 13 weeks ago
  const recent = session("2026-11-20", [{ id: "squat", weight: "100", reps: 10, sets: 3 }]);

  it("a 4 week window leaves out an older session; all time includes it", () => {
    expect(computeMuscleSetLevels([old, recent], SECTIONS, 28, TODAY).totalVolumeKg).toBe(3000);
    const all = computeMuscleSetLevels([old, recent], SECTIONS, null, TODAY);
    expect(all.totalVolumeKg).toBe(6000);
    expect(all.sessionsInWindow).toBe(2);
  });

  it("all time averages weekly sets over the time since the first session", () => {
    const all = computeMuscleSetLevels([old, recent], SECTIONS, null, TODAY);
    // 6 sets over 93 days (about 13.3 weeks)
    expect(all.levels.lower_push.totalSets).toBe(6);
    expect(all.levels.lower_push.weeklySets).toBeCloseTo(6 / (93 / 7), 1);
  });

  it("all time never divides by less than one week, and copes with no sessions", () => {
    const one = computeMuscleSetLevels([session("2026-11-24", [{ id: "squat", weight: "100", reps: 10, sets: 3 }])], SECTIONS, null, TODAY);
    expect(one.levels.lower_push.weeklySets).toBe(3);
    const none = computeMuscleSetLevels([], SECTIONS, null, TODAY);
    expect(none.totalVolumeKg).toBe(0);
    expect(none.sessionsInWindow).toBe(0);
  });
});

describe("formatVolumeKg", () => {
  it("adds separators and rounds", () => {
    expect(formatVolumeKg(100000)).toBe("100,000 kg");
    expect(formatVolumeKg(20000.4)).toBe("20,000 kg");
    expect(formatVolumeKg(NaN)).toBe("0 kg");
  });
});
