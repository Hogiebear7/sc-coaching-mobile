import { describe, expect, it } from "vitest";

import { formatNote, shareableNote, toTemplateExercises, workoutKind } from "../community-workout";
import type { WorkoutExerciseEntry } from "../queries/workouts";

const ex = (over: Partial<WorkoutExerciseEntry> = {}): WorkoutExerciseEntry => ({ exerciseId: null, name: "Back Squat", weight: "60", reps: 12, sets: 3, notes: null, ...over });

describe("workout type", () => {
  it("reads the format the app wrote, or says Standard", () => {
    expect(workoutKind([ex({ notes: "AMRAP: 12 min, 5 per round" })])).toEqual({ label: "AMRAP", detail: "12 min, 5 per round" });
    expect(workoutKind([ex(), ex({ notes: "Chipper: target 50 reps" })])).toEqual({ label: "Chipper", detail: "target 50 reps" });
    expect(workoutKind([ex({ notes: "EMOM: 10 min, every 60s" })]).label).toBe("EMOM");
    expect(workoutKind([ex(), ex({ notes: null })])).toEqual({ label: "Standard", detail: null });
  });

  it("does not mistake something the member typed for a format", () => {
    expect(formatNote("my amrap felt hard")).toBeNull();
    expect(formatNote("AMRAP with my knee strapped")).toBeNull();
    expect(workoutKind([ex({ notes: "knee sore today" })]).label).toBe("Standard");
  });
});

describe("what another member's notes may show", () => {
  it("only the app's own format line is shared", () => {
    expect(shareableNote("Circuit: 3 rounds, 40s per station")).toBe("Circuit: 3 rounds, 40s per station");
    expect(shareableNote("knee sore, went light")).toBeNull();
    expect(shareableNote(null)).toBeNull();
  });
});

describe("saving someone else's workout as a template", () => {
  it("keeps order, sets, reps and superset groups, blanks the weights and drops personal notes", () => {
    const rows = toTemplateExercises([
      ex({ name: "Back Squat", weight: "60", reps: 12, sets: 3, supersetGroup: "A", notes: "felt heavy" }),
      ex({ name: "Landmine row", weight: "30", reps: 12, sets: 3, supersetGroup: "A" }),
      ex({ name: "Single leg deadlift", weight: "16", reps: 8, sets: 3, perSide: true, setType: "normal" as never }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Back Squat", "Landmine row", "Single leg deadlift"]);
    expect(rows.map((r) => r.targetWeight)).toEqual([null, null, null]);
    expect(rows.map((r) => r.supersetGroup)).toEqual(["A", "A", null]);
    expect(rows[0]).toMatchObject({ targetSets: 3, targetReps: "12", notes: null });
    expect(rows[2].targetReps).toBe("R8 / L8");
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });

  it("falls back to the per-set reps when the shared figure is missing, and keeps a format line", () => {
    const [row] = toTemplateExercises([ex({ reps: null, sets: null, setDetails: [{ weight: "20", reps: 10 }, { weight: "20", reps: 10 }], notes: "AMRAP: 12 min" })]);
    expect(row).toMatchObject({ targetSets: 2, targetReps: "10", targetWeight: null, notes: "AMRAP: 12 min" });
  });
});
