import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/workout-summary", () => ({}));

import { buildClassWorkoutSummary } from "../class-summary";
import type { CreateWorkoutExerciseInput, PersonalBest } from "../queries/workouts";

const ex = (over: Partial<CreateWorkoutExerciseInput>): CreateWorkoutExerciseInput => ({
  exerciseId: null,
  name: "Back Squat",
  weight: "60",
  reps: 10,
  sets: 4,
  rir: null,
  setDetails: [],
  setType: null,
  supersetGroup: null,
  perSide: false,
  notes: null,
  ...over,
});

const session = { id: "s1", title: "Private Class", date: "2026-11-12", durationMins: 50 };

describe("buildClassWorkoutSummary", () => {
  it("adds up volume and sets from sets x reps x weight, and counts them all as done", () => {
    const s = buildClassWorkoutSummary(session, [ex({})], []);
    expect(s.totalVolume).toBe(2400);
    expect(s.totalSets).toBe(4);
    expect(s.completedSets).toBe(4);
    expect(s.durationLabel).toBe("50 min");
  });

  it("uses per-set detail and adds right and left reps for a left/right exercise", () => {
    const s = buildClassWorkoutSummary(
      session,
      [ex({ name: "Single-Arm Row", weight: null, reps: null, sets: 2, perSide: true, setDetails: [{ weight: "20", reps: null, repsRight: 10, repsLeft: 10 }, { weight: "20", reps: null, repsRight: 8, repsLeft: 8 }] })],
      []
    );
    expect(s.totalVolume).toBe(20 * 20 + 20 * 16);
    expect(s.totalSets).toBe(2);
  });

  it("flags a personal best only when it beats the recorded one", () => {
    const pbs = [{ exerciseName: "back squat", heaviestWeight: { weightStr: "70kg", value: 70, date: "2026-10-01", reps: 5 }, highestReps: null }] as PersonalBest[];
    expect(buildClassWorkoutSummary(session, [ex({ weight: "60" })], pbs).exercises[0].isPb).toBe(false);
    expect(buildClassWorkoutSummary(session, [ex({ weight: "75" })], pbs).exercises[0].isPb).toBe(true);
    expect(buildClassWorkoutSummary(session, [ex({ weight: "75" })], []).exercises[0].isPb).toBe(true);
  });

  it("shows a dash when the class has no length", () => {
    expect(buildClassWorkoutSummary({ ...session, durationMins: null }, [ex({})], []).durationLabel).toBe("—");
  });
});
