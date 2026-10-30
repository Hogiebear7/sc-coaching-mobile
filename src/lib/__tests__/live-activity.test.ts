import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(() => Promise.resolve(null)), setItem: vi.fn(() => Promise.resolve()) } }));

import { classActivityActive, classChipText, classStartMs, clock, workoutElapsedSecs } from "../widgets/live-activity";

const START = new Date(2026, 9, 31, 10, 0).getTime();
const cls = { title: "Over 50s", startsAtMs: START, durationMins: 45 };

describe("live activity rules", () => {
  it("the class countdown runs from 60 minutes before to 15 minutes after the start (Android: only when imminent)", () => {
    expect(classActivityActive(cls, START - 61 * 60_000)).toBe(false);
    expect(classActivityActive(cls, START - 60 * 60_000)).toBe(true);
    expect(classActivityActive(cls, START + 14 * 60_000)).toBe(true);
    expect(classActivityActive(cls, START + 15 * 60_000)).toBe(false);
  });

  it("chip text stays under 7 characters so Android shows it whole", () => {
    expect(classChipText(cls, START - 42 * 60_000 + 1)).toBe("42m");
    expect(classChipText(cls, START - 90 * 60_000)).toBe("1h30");
    expect(classChipText(cls, START + 60_000)).toBe("Now");
  });

  it("workout time counts across pauses", () => {
    expect(workoutElapsedSecs({ title: "", startedAtMs: 1_000, accumulatedSecs: 120, setsDone: 0, currentExercise: null, restEndsAtMs: null }, 61_000)).toBe(180);
    expect(workoutElapsedSecs({ title: "", startedAtMs: null, accumulatedSecs: 95, setsDone: 0, currentExercise: null, restEndsAtMs: null }, 99_000)).toBe(95);
    expect(clock(725)).toBe("12:05");
    expect(clock(3725)).toBe("1:02:05");
  });

  it("reads a booked class's local start time", () => {
    expect(classStartMs("2026-10-31", "10:00")).toBe(START);
  });
});

import { workoutActivityFromDraft } from "../widgets/live-activity";

describe("workout live activity from the draft", () => {
  const rows = [
    { name: "Squat", setRows: [{ completed: true }, { completed: true }] },
    { name: "Bench press", setRows: [{ completed: true }, { completed: false }] },
    { name: "", setRows: [{ completed: true }] },
  ];
  it("shows only once the workout timer has started", () => {
    expect(workoutActivityFromDraft({ title: "Legs", startedAtMs: null, accumulatedSecs: 0, exerciseRows: rows }, null)).toBeNull();
  });
  it("counts completed sets on named exercises and picks the exercise still in progress", () => {
    expect(workoutActivityFromDraft({ title: "", startedAtMs: 5, accumulatedSecs: 0, exerciseRows: rows }, 99)).toEqual({
      title: "Workout",
      startedAtMs: 5,
      accumulatedSecs: 0,
      setsDone: 3,
      currentExercise: "Bench press",
      restEndsAtMs: 99,
    });
  });
});
