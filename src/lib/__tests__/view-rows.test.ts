import { describe, expect, it } from "vitest";

import type { WorkoutExerciseEntry, WorkoutRunEntry } from "../queries/workouts";
import { entryToRow, runToRow } from "../view-rows";

const ex = (over: Partial<WorkoutExerciseEntry> = {}): WorkoutExerciseEntry => ({ exerciseId: null, name: "Back Squat", weight: "60", reps: 12, sets: 3, notes: null, ...over });

describe("a saved exercise becomes a card row", () => {
  it("an entry logged as one summary expands to that many identical sets", () => {
    const row = entryToRow(ex());
    expect(row.setRows).toHaveLength(3);
    expect(row.setRows.every((s) => s.weight === "60" && s.reps === "12")).toBe(true);
    expect(row.unitMode).toBe("weight");
    expect(row.setRows.every((s) => s.completed === false)).toBe(true);
  });

  it("per-set details win, with set types and per-side reps", () => {
    const row = entryToRow(ex({ setDetails: [{ weight: "16", reps: null, repsRight: 8, repsLeft: 8 }, { weight: "16", reps: null, repsRight: 6, repsLeft: 7, setType: "failure" }] }));
    expect(row.perSide).toBe(true);
    expect(row.setRows.map((s) => [s.repsRight, s.repsLeft, s.setType])).toEqual([["8", "8", "standard"], ["6", "7", "failure"]]);
  });

  it("works out kg, time or band from what was typed", () => {
    expect(entryToRow(ex({ weight: "0:45", setDetails: null })).unitMode).toBe("time");
    expect(entryToRow(ex({ weight: "Purple band" })).unitMode).toBe("band");
    expect(entryToRow(ex({ weight: null, reps: null })).unitMode).toBe("weight");
  });

  it("keeps supersets, order and the body part", () => {
    const row = entryToRow(ex({ supersetGroup: "ST1", order: 2, muscleSection: "core" }));
    expect([row.supersetGroup, row.order, row.muscleSection]).toEqual(["ST1", 2, "core"]);
  });
});

describe("a saved cardio entry becomes a card row", () => {
  it("shows distance and time the way the log does", () => {
    const run: WorkoutRunEntry = { distance: 5.2, distanceUnit: "km", durationSecs: 1500, reps: null, sets: null, notes: null, cardioType: "bike", supersetGroup: "ST2" };
    const row = runToRow(run);
    expect([row.distance, row.duration, row.cardioType, row.supersetGroup, row.typeChosen]).toEqual(["5.2", "25:00", "bike", "ST2", true]);
    expect(runToRow({ ...run, durationSecs: 3725 }).duration).toBe("1:02:05");
  });
});
