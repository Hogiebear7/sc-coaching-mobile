import { describe, expect, it, vi } from "vitest";

vi.mock("../../constants/theme", () => ({ DataColor: { sessions: "#111111", load: "#222222", sleep: "#333333", hydration: "#444444" } }));

import { describeCardio, formatCardioDistance, usesFloors } from "../cardio";
import { supersetBadges } from "../superset-display";

describe("describeCardio", () => {
  it("describes a single run with its pace", () => {
    expect(describeCardio({ cardioType: "run", distance: 5, durationSecs: 1500, sets: null })).toEqual({ perSet: "5 km · 25:00 · 5:00 /km", rounds: 1, total: null });
  });

  it("does not give a bike a pace", () => {
    expect(describeCardio({ cardioType: "bike", distance: 0.4, durationSecs: 58, sets: null }).perSet).toBe("0.4 km · 0:58");
  });

  it("totals a cardio line done every round of a superset", () => {
    expect(describeCardio({ cardioType: "bike", distance: 0.4, durationSecs: 58, sets: 4 })).toEqual({ perSet: "0.4 km · 0:58", rounds: 4, total: "1.6 km · 3:52" });
  });

  it("counts floors for the stair climber", () => {
    expect(usesFloors("stair_climber")).toBe(true);
    expect(formatCardioDistance("stair_climber", 12)).toBe("12 floors");
    expect(describeCardio({ cardioType: "stair_climber", distance: 10, durationSecs: 120, sets: 3 }).total).toBe("30 floors · 6:00");
  });
});

describe("supersetBadges", () => {
  it("labels members A1, A2, B1 in order and leaves the rest alone", () => {
    const b = supersetBadges(["ST1", "ST1", null, "ST2", "ST2"]);
    expect(b.map((x) => x?.label ?? null)).toEqual(["A1", "A2", null, "B1", "B2"]);
    expect(b[0]?.color).toBe(b[1]?.color);
    expect(b[0]?.color).not.toBe(b[3]?.color);
  });
});
