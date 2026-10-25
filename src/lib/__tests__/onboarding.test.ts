import { describe, expect, it } from "vitest";

import { clampWeight, defaultGoalWeight, directionFor, goalGapLabel } from "@/lib/onboarding";

describe("onboarding helpers", () => {
  it("rounds to half kilos and clamps to a sane range", () => {
    expect(clampWeight(80.26)).toBe(80.5);
    expect(clampWeight(10)).toBe(30);
    expect(clampWeight(400)).toBe(250);
  });

  it("starts 5 kg away for lose/gain, at current for maintain", () => {
    expect(defaultGoalWeight("lose", 80)).toBe(75);
    expect(defaultGoalWeight("gain", 80)).toBe(85);
    expect(defaultGoalWeight("maintain", 80.3)).toBe(80.5);
  });

  it("describes the gap in plain words", () => {
    expect(goalGapLabel(80, 73.5)).toBe("6.5 kg to lose");
    expect(goalGapLabel(80, 84)).toBe("4 kg to gain");
    expect(goalGapLabel(80, 80)).toBe("Hold steady at 80 kg");
  });

  it("infers direction from the numbers", () => {
    expect(directionFor(80, 75)).toBe("lose");
    expect(directionFor(80, 85)).toBe("gain");
    expect(directionFor(80, 80)).toBe("maintain");
  });
});
