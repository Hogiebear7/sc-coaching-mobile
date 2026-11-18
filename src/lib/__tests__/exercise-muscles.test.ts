import { describe, expect, it } from "vitest";

import { BODY_PART_CHOICES, muscleFocusFor, personalMuscleSections } from "@/lib/exercise-muscles";

describe("muscleFocusFor", () => {
  it("reads the muscles from the exercise name", () => {
    expect(muscleFocusFor("Prone Hamstring Curl")?.primary).toContain("hamstring");
    expect(muscleFocusFor("Goblet Squat")?.primary).toContain("quadriceps");
    expect(muscleFocusFor("Bench Press")?.primary).toContain("chest");
    expect(muscleFocusFor("Dumbbell/Kettlebell Single-Arm Bent-Over Row")?.primary).toContain("upper-back");
    expect(muscleFocusFor("Cable Pull Through (With Rope)")?.primary).toContain("gluteal");
    expect(muscleFocusFor("Band Walk")?.primary).toContain("gluteal");
    expect(muscleFocusFor("Concept2 Rower")?.region).toBe("lower");
    expect(muscleFocusFor("Bicep Curl")?.primary).toContain("biceps");
  });

  it("falls back to the library section, or nothing", () => {
    expect(muscleFocusFor("Mystery move", "core")?.primary).toContain("abs");
    expect(muscleFocusFor("Mystery move")).toBeNull();
  });
});

describe("the body part a member picks for their own exercise", () => {
  it("wins over the name rules and the library section", () => {
    // "Sandbag clean" matches no name rule; a name that does ("hamstring curl") still gives way to the member's own choice
    expect(muscleFocusFor("Sandbag clean", null)).toBeNull();
    expect(muscleFocusFor("Sandbag clean", null, "lower_pull")?.primary).toContain("gluteal");
    expect(muscleFocusFor("Hamstring curl", null)?.primary).toContain("hamstring");
    expect(muscleFocusFor("Hamstring curl", null, "core")?.primary).toContain("abs");
  });

  it("offers all six body parts, once each", () => {
    expect(BODY_PART_CHOICES.map((c) => c.section).sort()).toEqual(["cardio", "core", "lower_pull", "lower_push", "upper_pull", "upper_push"]);
  });

  it("remembers the choice by name from past workouts, newest first", () => {
    const map = personalMuscleSections([
      { exercises: [{ name: "Sandbag Clean", muscleSection: "lower_pull" }, { name: "Row", muscleSection: null }] },
      { exercises: [{ name: "sandbag clean", muscleSection: "core" }] },
    ]);
    expect(map.get("sandbag clean")).toBe("lower_pull");
    expect(map.has("row")).toBe(false);
  });
});
