import { describe, expect, it } from "vitest";

import { localISODate, pregnancyStageFromTrimester, trainedBuckets } from "../context";
import type { LibraryExercise } from "../types";

const squat: LibraryExercise = {
  id: "sq",
  name: "Barbell Back Squat",
  bodyPart: "upper legs",
  equipment: "barbell",
  difficulty: "intermediate",
  taxonomy: { mechanic: "compound", forceType: "knee_dominant", primaryRegion: "lower_body", bodyPosition: "standing" },
};
const curl: LibraryExercise = {
  id: "cu",
  name: "Dumbbell Curl",
  bodyPart: "upper arms",
  equipment: "dumbbell",
  difficulty: "beginner",
  taxonomy: { mechanic: "isolation", forceType: "pull", primaryRegion: "upper_body", bodyPosition: "standing" },
};

describe("trainedBuckets", () => {
  it("returns the groups of compound lifts done on that day only", () => {
    const sessions = [
      { date: "2026-11-23", exercises: [{ exerciseId: "sq" }, { exerciseId: "cu" }, { exerciseId: null }] },
      { date: "2026-11-20", exercises: [{ exerciseId: "sq" }] },
    ];
    expect(trainedBuckets(sessions, [squat, curl], "2026-11-23")).toEqual(["lower_push"]);
    expect(trainedBuckets(sessions, [squat, curl], "2026-11-22")).toEqual([]);
  });
});

describe("helpers", () => {
  it("formats a local date a number of days back", () => {
    expect(localISODate(1, new Date(2026, 10, 24, 9, 0))).toBe("2026-11-23");
    expect(localISODate(0, new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
  });

  it("maps the app's trimester to the engine's stage", () => {
    expect(pregnancyStageFromTrimester(true, 1)).toBe("first");
    expect(pregnancyStageFromTrimester(true, 2)).toBe("second");
    expect(pregnancyStageFromTrimester(true, 3)).toBe("third");
    expect(pregnancyStageFromTrimester(false, 2)).toBeNull();
    expect(pregnancyStageFromTrimester(true, "postpartum")).toBeNull();
  });
});
