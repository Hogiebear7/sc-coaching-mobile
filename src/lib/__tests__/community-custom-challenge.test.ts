import { describe, expect, it } from "vitest";

import {
  CARDIO_TYPE_OPTIONS,
  CUSTOM_MEASURES,
  buildChallengeRows,
  challengeDisplayLabel,
  customChallengeHint,
  customMeasureInfo,
  customPayload,
  customPreview,
  formatChallengeValue,
  formatSeconds,
  parseDistanceKm,
  suggestedCustomTitle,
  validateCustomForm,
  type CustomForm,
} from "@/lib/community-groups-format";

const form = (over: Partial<CustomForm> = {}): CustomForm => ({ measure: null, exercise: "", cardioType: null, distanceText: "", ...over });

describe("custom measures", () => {
  it("each measure has a unit and a way it is scored, and the units match what the server uses", () => {
    expect(CUSTOM_MEASURES).toHaveLength(8);
    expect(customMeasureInfo("best_weight").unit).toBe("kg");
    expect(customMeasureInfo("total_volume").unit).toBe("kg");
    expect(customMeasureInfo("best_reps").unit).toBe("reps");
    expect(customMeasureInfo("total_distance").unit).toBe("km");
    expect(customMeasureInfo("total_time").unit).toBe("min");
    expect(customMeasureInfo("fastest_time").unit).toBe("secs");
    expect(customMeasureInfo("fastest_time").scoring).toMatch(/lowest/i);
    for (const m of CUSTOM_MEASURES) {
      expect(m.scoring.length).toBeGreaterThan(5);
      expect(m.hint.length).toBeGreaterThan(10);
    }
  });

  it("four measures are about an exercise and four about an activity", () => {
    expect(CUSTOM_MEASURES.filter((m) => m.kind === "strength").map((m) => m.id)).toEqual(["best_weight", "total_volume", "best_reps", "total_reps"]);
    expect(CUSTOM_MEASURES.filter((m) => m.kind === "cardio").map((m) => m.id)).toEqual(["total_distance", "longest_distance", "total_time", "fastest_time"]);
  });

  it("offers every cardio type the server accepts", () => {
    expect(CARDIO_TYPE_OPTIONS.map((c) => c.id).sort()).toEqual(["bike", "cross_trainer", "other", "rower", "run", "stair_climber", "treadmill_walk", "walk"]);
  });
});

describe("formatSeconds and the values a custom challenge shows", () => {
  it("a time to beat always reads as hh:mm:ss, so a 5 km run and a very long one look the same", () => {
    expect(formatSeconds(1258)).toBe("00:20:58");
    expect(formatSeconds(59)).toBe("00:00:59");
    expect(formatSeconds(3600)).toBe("01:00:00");
    expect(formatSeconds(3930)).toBe("01:05:30");
    expect(formatSeconds(15150)).toBe("04:12:30"); // a marathon-length effort
    expect(formatSeconds(360000)).toBe("100:00:00"); // never cut off, even at 100 hours
    expect(formatSeconds(-4)).toBe("00:00:00");
  });

  it("the unit the server sends decides how a custom score reads", () => {
    expect(formatChallengeValue("custom", 120, "kg")).toBe("120 kg");
    expect(formatChallengeValue("custom", 1, "reps")).toBe("1 rep");
    expect(formatChallengeValue("custom", 24, "reps")).toBe("24 reps");
    expect(formatChallengeValue("custom", 5.2, "km")).toBe("5.2 km");
    expect(formatChallengeValue("custom", 75, "min")).toBe("1 h 15 min");
    expect(formatChallengeValue("custom", 1258, "secs")).toBe("00:20:58");
  });

  it("a custom challenge with no unit shows a plain number, never a wrong unit; ready-made kinds keep their own", () => {
    expect(formatChallengeValue("custom", 12)).toBe("12");
    expect(formatChallengeValue("run_distance", 12)).toBe("12 km");
    expect(formatChallengeValue("squat", 100)).toBe("100 kg");
  });

  it("standings use the challenge's unit, so a 5 km time shows as hh:mm:ss and the order is the server's (lowest first)", () => {
    const rows = buildChallengeRows(
      [
        { userId: "a", displayName: "Rae", value: 1258, bodyweightPct: null },
        { userId: "me", displayName: "Sam", value: 1500, bodyweightPct: null },
      ],
      { metric: "custom", unit: "secs" },
      "me"
    );
    expect(rows.map((r) => [r.rank, r.name, r.valueLabel])).toEqual([[1, "Rae", "00:20:58"], [2, "You", "00:25:00"]]);
  });
});

describe("parseDistanceKm", () => {
  it("reads what people type", () => {
    expect(parseDistanceKm("5")).toBe(5);
    expect(parseDistanceKm(" 5.0 ")).toBe(5);
    expect(parseDistanceKm("5,5")).toBe(5.5);
    expect(parseDistanceKm("21.0975")).toBe(21.1);
    expect(parseDistanceKm("")).toBeNull();
    expect(parseDistanceKm("far")).toBeNull();
  });
});

describe("validateCustomForm (same rules as the server)", () => {
  it("needs a measure first", () => {
    expect(validateCustomForm(form())).toBe("Choose what to measure.");
  });

  it("a strength measure needs an exercise of 2 to 40 characters with a letter", () => {
    expect(validateCustomForm(form({ measure: "best_weight" }))).toMatch(/exercise/i);
    expect(validateCustomForm(form({ measure: "best_weight", exercise: "a" }))).toMatch(/exercise/i);
    expect(validateCustomForm(form({ measure: "best_weight", exercise: "12345" }))).toMatch(/exercise/i);
    expect(validateCustomForm(form({ measure: "best_weight", exercise: "x".repeat(41) }))).toMatch(/exercise/i);
    expect(validateCustomForm(form({ measure: "best_weight", exercise: "Front squat" }))).toBeNull();
  });

  it("a cardio measure needs an activity, and a fastest time also needs a sensible distance", () => {
    expect(validateCustomForm(form({ measure: "total_distance" }))).toBe("Choose the activity.");
    expect(validateCustomForm(form({ measure: "total_distance", cardioType: "bike" }))).toBeNull();
    expect(validateCustomForm(form({ measure: "fastest_time", cardioType: "run" }))).toMatch(/distance/i);
    expect(validateCustomForm(form({ measure: "fastest_time", cardioType: "run", distanceText: "0" }))).toMatch(/distance/i);
    expect(validateCustomForm(form({ measure: "fastest_time", cardioType: "run", distanceText: "101" }))).toMatch(/distance/i);
    expect(validateCustomForm(form({ measure: "fastest_time", cardioType: "run", distanceText: "5" }))).toBeNull();
    expect(validateCustomForm(form({ measure: "fastest_time", cardioType: "run", distanceText: "0.1" }))).toBeNull();
  });
});

describe("what is sent", () => {
  it("a strength challenge sends the tidied exercise and nothing about cardio", () => {
    expect(customPayload(form({ measure: "best_weight", exercise: "  Front   squat ", cardioType: "run", distanceText: "5" }))).toEqual({ measure: "best_weight", subject: "Front squat" });
  });
  it("a cardio challenge sends the activity, and the distance only for a fastest time", () => {
    expect(customPayload(form({ measure: "total_time", cardioType: "bike", exercise: "ignored", distanceText: "9" }))).toEqual({ measure: "total_time", cardioType: "bike" });
    expect(customPayload(form({ measure: "fastest_time", cardioType: "run", distanceText: "5,5" }))).toEqual({ measure: "fastest_time", cardioType: "run", targetDistanceKm: 5.5 });
  });
});

describe("the title and the explanation made from the form", () => {
  it("suggests a name from what was chosen, for when the title is left blank", () => {
    expect(suggestedCustomTitle(form())).toBe("");
    expect(suggestedCustomTitle(form({ measure: "best_weight" }))).toBe("");
    expect(suggestedCustomTitle(form({ measure: "best_weight", exercise: "Front squat" }))).toBe("Front squat: best weight");
    expect(suggestedCustomTitle(form({ measure: "total_distance", cardioType: "bike" }))).toBe("Bike: total distance");
    expect(suggestedCustomTitle(form({ measure: "fastest_time", cardioType: "run", distanceText: "5" }))).toBe("5 km Run: fastest time");
    expect(suggestedCustomTitle(form({ measure: "best_weight", exercise: "x".repeat(40) })).length).toBeLessThanOrEqual(60);
  });

  it("explains how a fastest time is counted, with the actual window for the distance typed", () => {
    expect(customPreview(form())).toBe("");
    expect(customPreview(form({ measure: "fastest_time", cardioType: "run", distanceText: "5" }))).toContain("4.95 to 5.25 km");
    expect(customPreview(form({ measure: "best_weight", exercise: "Front squat" }))).toMatch(/warm-up/i);
  });

  it("describes a custom challenge on its own screen, with how it is scored", () => {
    const hint = customChallengeHint({ measure: "fastest_time", subject: "5 km Run", cardioType: "run", targetDistanceKm: 5 });
    expect(hint).toContain("4.95 to 5.25 km");
    expect(hint).toMatch(/lowest time wins/i);
    expect(customChallengeHint({ measure: "best_weight", subject: "Front squat", cardioType: null, targetDistanceKm: null })).toMatch(/kilograms/i);
    expect(customChallengeHint(null)).toBe("");
  });
});

describe("challengeDisplayLabel", () => {
  it("uses the name the server gave, and works one out for a ready-made kind from an older server", () => {
    expect(challengeDisplayLabel({ metric: "custom", label: "Front squat: best weight" })).toBe("Front squat: best weight");
    expect(challengeDisplayLabel({ metric: "run_distance" })).toBe("Running distance");
    expect(challengeDisplayLabel({ metric: "custom" })).toBe("Custom challenge");
  });
});
