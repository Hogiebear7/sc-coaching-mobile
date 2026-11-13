import { describe, expect, it } from "vitest";

import { groupSelected, nextSupersetLabel, ungroup } from "../superset-select";

type Row = { key: string; supersetGroup: string | null; order?: number | null };
const ex = (key: string, supersetGroup: string | null = null, order?: number): Row => ({ key, supersetGroup, order });
const run = (key: string, order?: number) => ({ key, order });
const summary = (rows: Row[]) => rows.map((r) => `${r.key}:${r.supersetGroup ?? "-"}:${r.order}`).join(" ");

describe("nextSupersetLabel", () => {
  it("is the next free number", () => {
    expect(nextSupersetLabel([])).toBe("ST1");
    expect(nextSupersetLabel(["ST1", null, "ST4"])).toBe("ST5");
  });
});

describe("groupSelected", () => {
  it("brings the chosen exercises together where the first one was", () => {
    const out = groupSelected([ex("a"), ex("b"), ex("c"), ex("d")], [], new Set(["a", "c"]), "ST1");
    expect(summary(out.exerciseRows)).toBe("a:ST1:0 c:ST1:1 b:-:2 d:-:3");
  });

  it("keeps cardio in the order and numbers everything", () => {
    const out = groupSelected([ex("a", null, 0), ex("b", null, 2), ex("c", null, 3)], [run("r", 1)], new Set(["a", "c"]), "ST1");
    expect(summary(out.exerciseRows)).toBe("a:ST1:0 c:ST1:1 b:-:3");
    expect(out.runRows.map((r) => `${r.key}:${r.order}`)).toEqual(["r:2"]);
  });

  it("needs at least two exercises", () => {
    const rows = [ex("a"), ex("b")];
    expect(groupSelected(rows, [], new Set(["a"]), "ST1").exerciseRows).toBe(rows);
  });

  it("moves an exercise out of an older superset and clears one left alone", () => {
    const out = groupSelected([ex("a", "ST1"), ex("b", "ST1"), ex("c")], [], new Set(["b", "c"]), "ST2");
    expect(summary(out.exerciseRows)).toBe("a:-:0 b:ST2:1 c:ST2:2");
  });
});

describe("ungroup", () => {
  it("clears one superset only", () => {
    expect(summary(ungroup([ex("a", "ST1"), ex("b", "ST1"), ex("c", "ST2")], "ST1"))).toBe("a:-:undefined b:-:undefined c:ST2:undefined");
  });
});

import { assignSuperset, availableSupersetLabels, nextSupersetInCycle, withoutLonelySupersets } from "../superset-select";

describe("tapping an exercise number", () => {
  it("offers one superset per two exercises", () => {
    expect(availableSupersetLabels(1)).toEqual([]);
    expect(availableSupersetLabels(3)).toEqual(["ST1"]);
    expect(availableSupersetLabels(5)).toEqual(["ST1", "ST2"]);
  });

  it("cycles none, then A, then B, then back to none", () => {
    expect(nextSupersetInCycle(null, 5)).toBe("ST1");
    expect(nextSupersetInCycle("ST1", 5)).toBe("ST2");
    expect(nextSupersetInCycle("ST2", 5)).toBeNull();
  });

  it("with room for one superset, two taps take it out again", () => {
    expect(nextSupersetInCycle(null, 3)).toBe("ST1");
    expect(nextSupersetInCycle("ST1", 3)).toBeNull();
  });

  it("does nothing with a single exercise, and clears a label that no longer fits", () => {
    expect(nextSupersetInCycle(null, 1)).toBeNull();
    expect(nextSupersetInCycle("ST7", 4)).toBeNull();
  });
});

describe("assignSuperset", () => {
  it("brings the exercise next to the others in its superset", () => {
    const out = assignSuperset([ex("a", "ST1"), ex("b"), ex("c"), ex("d")], [], "d", "ST1");
    expect(summary(out.exerciseRows)).toBe("a:ST1:0 d:ST1:1 b:-:2 c:-:3");
  });

  it("leaves the order alone for the first member, and when taking an exercise out", () => {
    expect(summary(assignSuperset([ex("a"), ex("b")], [], "b", "ST1").exerciseRows)).toBe("a:-:0 b:ST1:1");
    expect(summary(assignSuperset([ex("a", "ST1"), ex("b", "ST1")], [], "b", null).exerciseRows)).toBe("a:ST1:0 b:-:1");
  });

  it("clears lonely labels when saving", () => {
    expect(summary(withoutLonelySupersets([ex("a", "ST1"), ex("b", "ST2"), ex("c", "ST2")]))).toBe("a:-:undefined b:ST2:undefined c:ST2:undefined");
  });
});

import { nextSupersetTap } from "../superset-select";

describe("nextSupersetTap", () => {
  const rows = (...groups: (string | null)[]) => groups.map((g, i) => ({ key: `k${i}`, supersetGroup: g }));

  it("joins the superset of the exercise directly above first", () => {
    // A1 A2, then B1, then a new exercise: its first tap is B (ST2), never A.
    expect(nextSupersetTap(rows("ST1", "ST1", "ST2", null), "k3")).toBe("ST2");
  });

  it("starts the first superset when nothing above is in one", () => {
    expect(nextSupersetTap(rows(null, null), "k1")).toBe("ST1");
  });

  it("then offers the other supersets, then none", () => {
    const r = rows("ST1", "ST1", "ST2", "ST2", "ST2", null);
    expect(nextSupersetTap(r, "k5")).toBe("ST2");
    const joined = rows("ST1", "ST1", "ST2", "ST2", "ST2", "ST2");
    expect(nextSupersetTap(joined, "k5")).toBe("ST1");
  });

  it("does nothing for a single exercise", () => {
    expect(nextSupersetTap(rows(null), "k0")).toBeUndefined();
  });
});
