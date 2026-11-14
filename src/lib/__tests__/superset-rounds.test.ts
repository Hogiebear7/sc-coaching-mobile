import { describe, expect, it } from "vitest";

import { addRound, canShowRounds, isRoundComplete, removeLastRound, roundCount, toggleRound, type RoundRow } from "../superset-rounds";

type S = { key: string; completed: boolean };
const set = (key: string, completed = false): S => ({ key, completed });
const row = (key: string, sets: S[], unitMode: RoundRow["unitMode"] = "weight"): RoundRow<S> => ({ key, unitMode, setRows: sets });

describe("rounds view", () => {
  it("is for two or more weight exercises only", () => {
    expect(canShowRounds([row("a", []), row("b", [])])).toBe(true);
    expect(canShowRounds([row("a", [])])).toBe(false);
    expect(canShowRounds([row("a", []), row("b", [], "time")])).toBe(true);
  });

  it("has as many rounds as the longest exercise", () => {
    expect(roundCount([row("a", [set("1"), set("2")]), row("b", [set("3")])])).toBe(2);
    expect(roundCount([])).toBe(0);
  });

  it("a round is done only when every exercise has it and has ticked it", () => {
    const rows = [row("a", [set("1", true), set("2", true)]), row("b", [set("3", true)])];
    expect(isRoundComplete(rows, 0)).toBe(true);
    expect(isRoundComplete(rows, 1)).toBe(false);
  });

  it("add round evens everything up and then adds one", () => {
    let n = 0;
    const out = addRound([row("a", [set("1"), set("2")]), row("b", [set("3")])], () => set(`new${++n}`));
    expect(out.map((r) => r.setRows.length)).toEqual([3, 3]);
  });

  it("remove last takes one set off each, and never the last round", () => {
    const out = removeLastRound([row("a", [set("1"), set("2")]), row("b", [set("3"), set("4")])]);
    expect(out.map((r) => r.setRows.length)).toEqual([1, 1]);
    expect(removeLastRound(out)).toBe(out);
  });

  it("ticking a round ticks every exercise's set, and ticking again undoes it", () => {
    const rows = [row("a", [set("1"), set("2")]), row("b", [set("3"), set("4")])];
    const first = toggleRound(rows, 1);
    expect(first.nowComplete).toBe(true);
    expect(first.rows.map((r) => r.setRows.map((s) => s.completed))).toEqual([[false, true], [false, true]]);
    const second = toggleRound(first.rows, 1);
    expect(second.nowComplete).toBe(false);
    expect(second.rows.every((r) => r.setRows.every((s) => !s.completed))).toBe(true);
  });

  it("a half-ticked round gets ticked, not cleared", () => {
    const rows = [row("a", [set("1", true)]), row("b", [set("2", false)])];
    expect(toggleRound(rows, 0).nowComplete).toBe(true);
  });
});
