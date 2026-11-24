import { describe, expect, it } from "vitest";

import { DANGER_REPLIES, DANGER_SIGNS, SORE_TTL_DAYS, activeSoreAreas, assessIntake, dangerLevel, mergeAreas, rehabAreas } from "../injury-intake";

describe("dangerLevel", () => {
  it("is null with nothing ticked and takes the most serious level otherwise", () => {
    expect(dangerLevel([])).toBeNull();
    expect(dangerLevel(["weight"])).toBe("urgent");
    expect(dangerLevel(["weight", "chest"])).toBe("emergency");
    expect(dangerLevel(["weight", "pregnancy"])).toBe("pregnancy");
  });
  it("has a sign for each kind of level, each with a unique id", () => {
    expect(new Set(DANGER_SIGNS.map((s) => s.level))).toEqual(new Set(["emergency", "urgent", "pregnancy"]));
    expect(new Set(DANGER_SIGNS.map((s) => s.id)).size).toBe(DANGER_SIGNS.length);
  });
});

describe("assessIntake", () => {
  it("any danger sign means get checked and no workout is offered, even with an area chosen", () => {
    const out = assessIntake({ areas: ["knee"], dangers: ["weight"] });
    expect(out.kind).toBe("danger");
    if (out.kind === "danger") {
      expect(out.reply).toMatch(/seen today/);
      expect(out.reply).toMatch(/don't train the affected area/);
    }
  });

  it("an emergency sign sends them to 112 or 999", () => {
    const out = assessIntake({ areas: [], dangers: ["chest"] });
    expect(out.kind === "danger" && out.reply).toMatch(/112 or 999/);
  });

  it("needs an area when there are no danger signs", () => {
    expect(assessIntake({ areas: [], dangers: [] })).toEqual({ kind: "incomplete" });
  });

  it("with only an area it makes no judgement about training, and gives no cause, treatment or timeline", () => {
    const out = assessIntake({ areas: ["lower_back", "hip"], dangers: [] });
    expect(out.kind).toBe("ok");
    if (out.kind !== "ok") return;
    expect(out.areas).toEqual(["lower_back", "hip"]);
    expect(out.message).toMatch(/can't tell you whether you should train/);
    expect(out.message).toMatch(/lower back, hip/);
    expect(out.message).toMatch(/physio or GP/);
    expect(out.message).not.toMatch(/\b(safe|strain|sprain|tendon|tear|heal|recover|rest it|ice)\b/i);
  });

  it("every fixed reply says it is not medical advice", () => {
    for (const r of Object.values(DANGER_REPLIES)) expect(r).toMatch(/isn't medical advice/);
  });
});

describe("activeSoreAreas", () => {
  const NOW = new Date("2026-11-24T12:00:00Z");
  it("keeps a note for 3 days then lets it lapse", () => {
    expect(SORE_TTL_DAYS).toBe(3);
    expect(activeSoreAreas({ areas: ["knee"], savedAt: "2026-11-22T12:00:00Z" }, NOW)).toEqual(["knee"]);
    expect(activeSoreAreas({ areas: ["knee"], savedAt: "2026-11-20T12:00:00Z" }, NOW)).toEqual([]);
  });
  it("ignores bad data and unknown areas", () => {
    expect(activeSoreAreas(null, NOW)).toEqual([]);
    expect(activeSoreAreas({ areas: ["knee", "spleen"] as never, savedAt: "2026-11-24T10:00:00Z" }, NOW)).toEqual(["knee"]);
    expect(activeSoreAreas({ areas: ["knee"], savedAt: "garbage" }, NOW)).toEqual([]);
    expect(activeSoreAreas({ areas: ["knee"], savedAt: "2027-01-01T00:00:00Z" }, NOW)).toEqual([]);
  });
});

describe("rehabAreas and mergeAreas", () => {
  it("takes areas from active rehab only", () => {
    expect(
      rehabAreas([
        { kind: "rehab", active: true, area: "ankle" },
        { kind: "rehab", active: false, area: "knee" },
        { kind: "goal", active: true, area: "hip" },
        { kind: "rehab", active: true, area: "toe" },
        { kind: "rehab", active: true },
      ])
    ).toEqual(["ankle"]);
  });
  it("merges without repeats, in a stable order", () => {
    expect(mergeAreas(["knee", "ankle"], ["knee"], ["neck"])).toEqual(["ankle", "knee", "neck"]);
  });
});
