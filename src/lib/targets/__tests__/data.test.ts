import { describe, expect, it } from "vitest";

import { EMPTY_STATE, addEntry, hasActiveRehab, normaliseTime, parseState, progressText, pruneEntries, quickAmounts, removeTarget, undoLastEntry, upsertTarget } from "../data";
import type { Target } from "../index";

const NOW = new Date(2026, 10, 24, 10, 0);
const goal: Target = { id: "g1", kind: "goal", title: "Squats", period: "day", goalCount: 500, unit: "reps", active: true };
const rehab: Target = { id: "r1", kind: "rehab", title: "Ankle band work", period: "day", goalCount: 3, unit: "sets", active: true, area: "ankle" };

describe("parseState", () => {
  it("survives junk, empty and damaged data", () => {
    expect(parseState(null)).toEqual(EMPTY_STATE);
    expect(parseState("nope")).toEqual(EMPTY_STATE);
    expect(parseState({ targets: "x", entries: 5 })).toEqual(EMPTY_STATE);
  });

  it("keeps good targets, drops bad ones and entries for missing targets", () => {
    const s = parseState({
      targets: [goal, { id: "x" }, { ...rehab, goalCount: -1 }, { ...rehab, period: "year" }],
      entries: [{ targetId: "g1", at: NOW.toISOString(), amount: 10 }, { targetId: "gone", at: NOW.toISOString(), amount: 1 }, { targetId: "g1", at: "bad", amount: 1 }],
    });
    expect(s.targets.map((t) => t.id)).toEqual(["g1"]);
    expect(s.entries).toHaveLength(1);
  });

  it("cleans up fields: trims the title, defaults the unit, ignores a full week of days", () => {
    const s = parseState({ targets: [{ ...goal, title: "  Squats  ", unit: "", days: [0, 1, 2, 3, 4, 5, 6], reminders: { times: ["09:00", "x"] } }], entries: [] });
    expect(s.targets[0]).toMatchObject({ title: "Squats", unit: "times", days: undefined, reminders: { times: ["09:00"] } });
  });
});

describe("entries", () => {
  it("logs an amount and ignores unknown targets and zero", () => {
    const s = upsertTarget(EMPTY_STATE, goal);
    expect(addEntry(s, "g1", 50, NOW).entries).toHaveLength(1);
    expect(addEntry(s, "nope", 50, NOW)).toBe(s);
    expect(addEntry(s, "g1", 0, NOW)).toBe(s);
  });

  it("undoes only the most recent entry for that target", () => {
    let s = upsertTarget(upsertTarget(EMPTY_STATE, goal), rehab);
    s = addEntry(s, "g1", 10, new Date(2026, 10, 24, 8));
    s = addEntry(s, "g1", 20, new Date(2026, 10, 24, 9));
    s = addEntry(s, "r1", 1, new Date(2026, 10, 24, 9, 30));
    const after = undoLastEntry(s, "g1");
    expect(after.entries.filter((e) => e.targetId === "g1").map((e) => e.amount)).toEqual([10]);
    expect(after.entries.filter((e) => e.targetId === "r1")).toHaveLength(1);
  });

  it("drops entries older than 45 days", () => {
    const old = { targetId: "g1", at: new Date(2026, 8, 1).toISOString(), amount: 5 };
    const recent = { targetId: "g1", at: new Date(2026, 10, 20).toISOString(), amount: 5 };
    expect(pruneEntries([old, recent], NOW)).toEqual([recent]);
  });

  it("deleting a target deletes its entries", () => {
    let s = upsertTarget(upsertTarget(EMPTY_STATE, goal), rehab);
    s = addEntry(s, "g1", 10, NOW);
    expect(removeTarget(s, "g1")).toMatchObject({ targets: [rehab], entries: [] });
  });
});

describe("helpers", () => {
  it("shows the rehab row only while a rehab target is on", () => {
    expect(hasActiveRehab([goal])).toBe(false);
    expect(hasActiveRehab([goal, { ...rehab, active: false }])).toBe(false);
    expect(hasActiveRehab([goal, rehab])).toBe(true);
  });

  it("writes progress in plain words", () => {
    expect(progressText(350, 500, "reps", "day")).toBe("350 of 500 reps today");
    expect(progressText(12.5, 50, "km", "month")).toBe("12.5 of 50 km this month");
  });

  it("sizes the quick-add buttons to the goal", () => {
    expect(quickAmounts(3)).toEqual([1]);
    expect(quickAmounts(500)).toEqual([10, 25, 50, 100]);
  });

  it("normalises times", () => {
    expect(normaliseTime("9:05")).toBe("09:05");
    expect(normaliseTime("0930")).toBe("09:30");
    expect(normaliseTime("25:00")).toBeNull();
    expect(normaliseTime("abc")).toBeNull();
  });
});
