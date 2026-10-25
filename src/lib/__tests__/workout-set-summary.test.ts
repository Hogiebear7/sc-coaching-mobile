import { describe, expect, it } from "vitest";

import type { WorkoutExerciseEntry } from "@/lib/queries/workouts";
import { exerciseSetSummary, groupSetLabels, prettySetLabel } from "@/lib/workout-formatters";

function entry(partial: Partial<WorkoutExerciseEntry>): WorkoutExerciseEntry {
  return { exerciseId: null, name: "Squat", weight: null, reps: null, sets: null, notes: null, ...partial };
}

function set(weight: string | null, reps: number | null) {
  return { weight, reps } as NonNullable<WorkoutExerciseEntry["setDetails"]>[number];
}

describe("prettySetLabel", () => {
  it("spaces the multiplication sign", () => {
    expect(prettySetLabel("15 kg×20")).toBe("15 kg × 20");
    expect(prettySetLabel("0:45×1")).toBe("0:45 × 1");
  });
  it("turns a reps-only label into words", () => {
    expect(prettySetLabel("×10")).toBe("10 reps");
    expect(prettySetLabel("×8/side")).toBe("8 reps /side");
  });
  it("leaves unilateral labels alone", () => {
    expect(prettySetLabel("20 kg R10/L10")).toBe("20 kg R10/L10");
  });
});

describe("groupSetLabels", () => {
  it("collapses identical consecutive sets", () => {
    expect(groupSetLabels(["15 kg×20", "15 kg×20", "15 kg×20"])).toEqual([{ from: 1, to: 3, label: "15 kg × 20" }]);
  });
  it("keeps changes as separate rows", () => {
    expect(groupSetLabels(["40 kg×12", "40 kg×12", "50 kg×8", "40 kg×12"])).toEqual([
      { from: 1, to: 2, label: "40 kg × 12" },
      { from: 3, to: 3, label: "50 kg × 8" },
      { from: 4, to: 4, label: "40 kg × 12" },
    ]);
  });
  it("treats a set typed without kg as the same set", () => {
    expect(groupSetLabels(["55 kg×10", "55×10", "55×10", "55×10"])).toEqual([{ from: 1, to: 4, label: "55 kg × 10" }]);
  });
  it("handles no sets", () => {
    expect(groupSetLabels([])).toEqual([]);
  });
});

describe("exerciseSetSummary", () => {
  it("summarises matching sets", () => {
    const ex = entry({ setDetails: [set("15 kg", 20), set("15 kg", 20), set("15 kg", 20), set("15 kg", 20)] });
    expect(exerciseSetSummary(ex)).toBe("4 sets · 15 kg × 20");
  });
  it("shows first and last when sets progress", () => {
    const ex = entry({ setDetails: [set("40 kg", 12), set("45 kg", 10), set("50 kg", 8)] });
    expect(exerciseSetSummary(ex)).toBe("3 sets · 40 kg × 12 → 50 kg × 8");
  });
  it("uses singular for one set", () => {
    expect(exerciseSetSummary(entry({ setDetails: [set("100 kg", 1)] }))).toBe("1 set · 100 kg × 1");
  });
  it("falls back to the prescription without set detail", () => {
    expect(exerciseSetSummary(entry({ sets: 3, reps: 10, weight: "40 kg" }))).toBe("3 × 10 @ 40 kg");
  });
  it("says Logged when there is nothing to show", () => {
    expect(exerciseSetSummary(entry({}))).toBe("Logged");
  });
});
