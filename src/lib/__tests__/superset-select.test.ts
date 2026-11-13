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
