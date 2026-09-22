import { describe, expect, it } from "vitest";

import {
  buildLeaderboardRows,
  formatActivitySummary,
  formatCommunityDate,
  formatCount,
  formatLeaderboardContextLabel,
  formatPbExerciseName,
  formatPbHeadline,
  formatWorkoutTitle,
} from "@/lib/community-formatters";
import type { WorkoutExerciseEntry, WorkoutRunEntry } from "@/lib/queries/workouts";

function exercise(overrides: Partial<WorkoutExerciseEntry> = {}): WorkoutExerciseEntry {
  return {
    exerciseId: null,
    name: "Back Squat",
    weight: "100",
    reps: 5,
    sets: 3,
    setDetails: null,
    setType: null,
    supersetGroup: null,
    perSide: null,
    notes: null,
    ...overrides,
  };
}

function run(overrides: Partial<WorkoutRunEntry> = {}): WorkoutRunEntry {
  return {
    distance: 5,
    distanceUnit: "km",
    durationSecs: 1500,
    reps: null,
    sets: null,
    notes: null,
    ...overrides,
  };
}

describe("formatWorkoutTitle", () => {
  it("passes through a normal title unchanged", () => {
    expect(formatWorkoutTitle("Full Body")).toBe("Full Body");
  });

  it("falls back to a generic label for a blank title", () => {
    expect(formatWorkoutTitle("")).toBe("Workout");
    expect(formatWorkoutTitle("   ")).toBe("Workout");
  });

  it("falls back for a missing title", () => {
    expect(formatWorkoutTitle(null)).toBe("Workout");
    expect(formatWorkoutTitle(undefined)).toBe("Workout");
  });

  it("trims surrounding whitespace without altering interior content", () => {
    expect(formatWorkoutTitle("  Leg Day 2  ")).toBe("Leg Day 2");
  });
});

describe("formatCommunityDate", () => {
  it("formats a valid date in each style", () => {
    expect(formatCommunityDate("2026-03-05", "compact")).toMatch(/5 Mar/);
    expect(formatCommunityDate("2026-03-05", "short")).toMatch(/Thu, 5 Mar/);
    expect(formatCommunityDate("2026-03-05", "long")).toMatch(/Thursday, 5 March/);
  });

  it("never renders 'Invalid Date' for a malformed date string", () => {
    const result = formatCommunityDate("not-a-date", "long");
    expect(result).not.toMatch(/Invalid Date/i);
    expect(result).toBe("Date unknown");
  });

  it("handles a missing date without throwing", () => {
    expect(formatCommunityDate(null, "compact")).toBe("—");
    expect(formatCommunityDate(undefined, "short")).toBe("—");
  });
});

describe("formatCount", () => {
  it("formats and rounds a normal number", () => {
    expect(formatCount(1234.6)).toBe("1,235");
  });

  it("handles missing or non-finite values", () => {
    expect(formatCount(null)).toBe("—");
    expect(formatCount(undefined)).toBe("—");
    expect(formatCount(NaN)).toBe("—");
    expect(formatCount(Infinity)).toBe("—");
  });
});

describe("formatPbExerciseName", () => {
  it("trims a normal name", () => {
    expect(formatPbExerciseName("  Back Squat  ")).toBe("Back Squat");
  });

  it("reports a blank or missing name as null rather than an empty string", () => {
    expect(formatPbExerciseName("")).toBeNull();
    expect(formatPbExerciseName("   ")).toBeNull();
    expect(formatPbExerciseName(null)).toBeNull();
    expect(formatPbExerciseName(undefined)).toBeNull();
  });
});

describe("formatPbHeadline", () => {
  it("builds the normal sentence", () => {
    expect(formatPbHeadline("Alex", "Back Squat")).toEqual({ author: "Alex", rest: "hit a new Back Squat PB" });
  });

  it("degrades gracefully when the exercise name is missing", () => {
    expect(formatPbHeadline("Alex", null)).toEqual({ author: "Alex", rest: "hit a new PB" });
    expect(formatPbHeadline("Alex", "")).toEqual({ author: "Alex", rest: "hit a new PB" });
  });

  it("falls back for a blank author name", () => {
    expect(formatPbHeadline("  ", "Bench Press")).toEqual({ author: "A member", rest: "hit a new Bench Press PB" });
  });
});

describe("formatActivitySummary", () => {
  it("prioritizes exercises, then fills remaining slots with runs", () => {
    const result = formatActivitySummary(
      [exercise({ name: "Back Squat" }), exercise({ name: "Bench Press" })],
      [run()],
      3
    );
    expect(result.lines).toHaveLength(3);
    expect(result.lines[2]).toMatch(/^Run —/);
    expect(result.hiddenCount).toBe(0);
  });

  it("reports an accurate hidden count when there's more than fits", () => {
    const exercises = [exercise({ name: "A" }), exercise({ name: "B" }), exercise({ name: "C" })];
    const runs = [run(), run()];
    const result = formatActivitySummary(exercises, runs, 2);
    expect(result.lines).toHaveLength(2);
    // 3 exercises + 2 runs = 5 total, 2 shown -> 3 hidden.
    expect(result.hiddenCount).toBe(3);
  });

  it("reports zero hidden when everything fits", () => {
    const result = formatActivitySummary([exercise()], [], 3);
    expect(result.hiddenCount).toBe(0);
  });

  it("falls back to a generic exercise label for a blank name", () => {
    const result = formatActivitySummary([exercise({ name: "   " })], [], 3);
    expect(result.lines[0]).toMatch(/^Exercise —/);
  });
});

describe("formatLeaderboardContextLabel", () => {
  it("labels the preset ranges", () => {
    expect(formatLeaderboardContextLabel("volume", "all", null, null)).toBe("Volume · All time");
    expect(formatLeaderboardContextLabel("volume", "week", null, null)).toBe("Volume · This week");
    expect(formatLeaderboardContextLabel("squat", "month", null, null)).toBe("Squat · This month");
    expect(formatLeaderboardContextLabel("deadlift", "year", null, null)).toBe("Deadlift · This year");
  });

  it("describes a custom range by its actual bounds", () => {
    expect(formatLeaderboardContextLabel("bench", "custom", "2026-01-01", "2026-01-31")).toMatch(
      /^Bench · 1 Jan – 31 Jan$/
    );
  });

  it("handles a custom range with only one bound picked", () => {
    expect(formatLeaderboardContextLabel("bench", "custom", "2026-01-01", null)).toMatch(/1 Jan – today$/);
    expect(formatLeaderboardContextLabel("bench", "custom", null, "2026-01-31")).toMatch(/the start – 31 Jan$/);
  });

  it("falls back when no custom bound is picked yet", () => {
    expect(formatLeaderboardContextLabel("volume", "custom", null, null)).toBe("Volume · Custom range");
  });
});

describe("buildLeaderboardRows", () => {
  it("keeps two entries with the same display name as separate rows keyed by userId", () => {
    const rows = buildLeaderboardRows(
      [
        { userId: "user-1", displayName: "Alex Rider", value: 500, bodyweightPct: null },
        { userId: "user-2", displayName: "Alex Rider", value: 400, bodyweightPct: null },
      ],
      null
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.userId)).toEqual(["user-1", "user-2"]);
    expect(rows.every((r) => r.name === "Alex Rider")).toBe(true);
  });

  it("labels the viewer's own row 'You' without affecting anyone else's row", () => {
    const rows = buildLeaderboardRows(
      [
        { userId: "user-1", displayName: "Alex Rider", value: 500, bodyweightPct: null },
        { userId: "user-2", displayName: "Sam Byrne", value: 400, bodyweightPct: 82.5 },
      ],
      "user-2"
    );
    expect(rows[0]).toMatchObject({ name: "Alex Rider", isMe: false });
    expect(rows[1]).toMatchObject({ name: "You", isMe: true, bodyweightLabel: "82.5% BW" });
  });

  it("assigns rank by array position, 1-indexed", () => {
    const rows = buildLeaderboardRows(
      [
        { userId: "a", displayName: "A", value: 3, bodyweightPct: null },
        { userId: "b", displayName: "B", value: 2, bodyweightPct: null },
        { userId: "c", displayName: "C", value: 1, bodyweightPct: null },
      ],
      null
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});
