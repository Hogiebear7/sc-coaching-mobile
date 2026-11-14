import { describe, expect, it } from "vitest";

import { entrySegments, insertEntry, mergeSavedEntries, orderedEntries, orderToSave } from "../entry-order";

type Row = { key: string; order?: number | null };
const ex = (key: string, order?: number): Row => ({ key, order });
const keys = (list: { row: Row }[]) => list.map((e) => e.row.key).join(",");

describe("orderedEntries", () => {
  it("keeps the old picture for entries with no order: exercises, then cardio", () => {
    expect(keys(orderedEntries([ex("a"), ex("b")], [ex("r1")]))).toBe("a,b,r1");
  });

  it("puts cardio in the middle when it is numbered there", () => {
    const list = orderedEntries([ex("a", 0), ex("b", 2)], [ex("r1", 1)]);
    expect(keys(list)).toBe("a,r1,b");
  });

  it("numbered entries come before unnumbered ones", () => {
    expect(keys(orderedEntries([ex("old1"), ex("old2")], [ex("new", 0)]))).toBe("new,old1,old2");
  });
});

describe("entrySegments", () => {
  it("splits the exercises into two pieces around a cardio entry", () => {
    const segs = entrySegments([ex("a", 0), ex("b", 1), ex("c", 3)], [ex("r", 2)]);
    expect(segs.map((s) => (s.kind === "run" ? `run:${s.row.key}` : `ex:${s.rows.map((r) => r.key).join("+")}`))).toEqual(["ex:a+b", "run:r", "ex:c"]);
  });

  it("is one piece when there is no cardio", () => {
    expect(entrySegments([ex("a"), ex("b")], [])).toHaveLength(1);
  });
});

describe("insertEntry", () => {
  it("adds cardio right after the chosen exercise and numbers everything", () => {
    const out = insertEntry([ex("a"), ex("b"), ex("c")], [], { kind: "run", row: ex("r") }, "a");
    expect(out.runRows.map((r) => `${r.key}:${r.order}`)).toEqual(["r:1"]);
    expect(out.exerciseRows.map((r) => `${r.key}:${r.order}`)).toEqual(["a:0", "b:2", "c:3"]);
  });

  it("adds at the end when there is no anchor", () => {
    const out = insertEntry([ex("a", 0)], [ex("r", 1)], { kind: "exercise", row: ex("n") }, null);
    expect(out.exerciseRows.map((r) => `${r.key}:${r.order}`)).toEqual(["a:0", "n:2"]);
  });

  it("falls back to the end when the anchor is not there", () => {
    const out = insertEntry([ex("a")], [], { kind: "exercise", row: ex("n") }, "gone");
    expect(out.exerciseRows.map((r) => r.key)).toEqual(["a", "n"]);
  });

  it("does not change what it was given", () => {
    const original = [ex("a")];
    insertEntry(original, [], { kind: "run", row: ex("r") }, "a");
    expect(original[0].order).toBeUndefined();
  });
});

describe("saved entries", () => {
  it("orderToSave is null until something numbers the entry", () => {
    expect(orderToSave(ex("a"))).toBeNull();
    expect(orderToSave(ex("a", 4))).toBe(4);
  });

  it("mergeSavedEntries restores the saved order and keeps old sessions as they were", () => {
    const merged = mergeSavedEntries([{ order: 0 }, { order: 2 }], [{ order: 1 }]).map((m) => m.kind);
    expect(merged).toEqual(["exercise", "run", "exercise"]);
    const old = mergeSavedEntries([{}, {}], [{}]).map((m) => m.kind);
    expect(old).toEqual(["exercise", "exercise", "run"]);
  });
});
