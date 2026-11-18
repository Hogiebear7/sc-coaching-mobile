import { describe, expect, it } from "vitest";

import type { PrescribedExercise } from "../queries/programs";
import { newTemplateRow, parseTargetReps, rowsToTemplate, templateToRows } from "../template-rows";

const ex = (over: Partial<PrescribedExercise> = {}): PrescribedExercise => ({
  id: "e1",
  exerciseId: null,
  name: "Back Squat",
  muscleTags: [],
  targetSets: 3,
  targetReps: "8",
  targetWeight: "60kg",
  setType: null,
  sets: null,
  supersetGroup: null,
  notes: null,
  ...over,
});

describe("target reps", () => {
  it("reads a number, a per-side pair, or keeps free text aside", () => {
    expect(parseTargetReps("12")).toMatchObject({ reps: "12", perSide: false, extra: null });
    expect(parseTargetReps("R8 / L6")).toMatchObject({ repsRight: "8", repsLeft: "6", perSide: true });
    expect(parseTargetReps("8-10")).toMatchObject({ reps: "", extra: "8-10" });
    expect(parseTargetReps(null).extra).toBeNull();
  });
});

describe("a saved template becomes editable rows", () => {
  it("an older template with one target per exercise gets that many sets, each with the target", () => {
    const [row] = templateToRows([ex({ targetSets: 4, targetReps: "10", targetWeight: "50" })]);
    expect(row.setRows).toHaveLength(4);
    expect(row.setRows.every((s) => s.reps === "10" && s.weight === "50")).toBe(true);
    expect(row.unitMode).toBe("weight");
  });

  it("per-set targets win over the single target", () => {
    const [row] = templateToRows([ex({ sets: [{ reps: "12", weight: "40", setType: null }, { reps: "8", weight: "60", setType: "failure" }] })]);
    expect(row.setRows.map((s) => [s.weight, s.reps, s.setType])).toEqual([["40", "12", "standard"], ["60", "8", "failure"]]);
  });

  it("free-text reps are kept as a note, words in the weight box become a band/guidance box, clock times become time", () => {
    const [free, guidance, clock] = templateToRows([
      ex({ targetReps: "8-10", notes: "slow down" }),
      ex({ name: "Row", targetWeight: "RPE 8" }),
      ex({ name: "Plank", targetReps: null, targetWeight: "0:45" }),
    ]);
    expect(free.notes).toBe("slow down · Reps: 8-10");
    expect(guidance.unitMode).toBe("band");
    expect(clock.unitMode).toBe("time");
  });

  it("keeps supersets, the body part (as a tag) and the muscle tags already on the template", () => {
    const [row] = templateToRows([ex({ supersetGroup: "ST1", muscleTags: ["Chest", "section:upper_push"] })]);
    expect(row.supersetGroup).toBe("ST1");
    expect(row.muscleSection).toBe("upper_push");
    expect(row.tags).toEqual(["Chest"]);
  });

  it("leaves out an AI running protocol, which this editor cannot edit", () => {
    expect(templateToRows([ex({ conditioningProtocol: { structure: "continuous", reps: null, distanceMeters: 5000, description: "5k" } })])).toHaveLength(0);
  });
});

describe("rows become a saved template", () => {
  it("saves every set, the first as the headline target, and drops empty exercises", () => {
    const row = newTemplateRow(2);
    row.name = " Bench Press ";
    row.setRows[0].weight = "40";
    row.setRows[0].reps = "10";
    row.setRows[1].weight = "50";
    row.setRows[1].reps = "6";
    row.setRows[1].setType = "dropset";
    row.supersetGroup = "ST1";
    row.muscleSection = "upper_push";
    row.tags = ["Chest"];
    const saved = rowsToTemplate([row, newTemplateRow()]);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: "Bench Press", targetSets: 2, targetReps: "10", targetWeight: "40", supersetGroup: "ST1", muscleTags: ["Chest", "section:upper_push"] });
    expect(saved[0].sets).toEqual([{ reps: "10", weight: "40", setType: null }, { reps: "6", weight: "50", setType: "dropset" }]);
  });

  it("saves per-side reps as R / L and survives a round trip", () => {
    const row = newTemplateRow(1);
    row.name = "Single leg deadlift";
    row.perSide = true;
    row.setRows[0].repsRight = "8";
    row.setRows[0].repsLeft = "8";
    const [saved] = rowsToTemplate([row]);
    expect(saved.targetReps).toBe("R8 / L8");
    const [again] = templateToRows([saved]);
    expect(again.perSide).toBe(true);
    expect([again.setRows[0].repsRight, again.setRows[0].repsLeft]).toEqual(["8", "8"]);
  });
});
