import { describe, expect, it } from "vitest";

import { muscleFocusFor } from "@/lib/exercise-muscles";

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
