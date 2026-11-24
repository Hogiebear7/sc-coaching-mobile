import { describe, expect, it } from "vitest";

import { SORE_TTL_DAYS, activeSoreAreas, buildInjuryMessage, canSubmitIntake, mergeAreas, rehabAreas } from "../injury-intake";

describe("buildInjuryMessage", () => {
  it("describes only what the member chose and asks for general information", () => {
    const msg = buildInjuryMessage({ area: "lower_back", started: "days", feel: "tight", note: "after deadlifts" });
    expect(msg).toBe(
      "My lower back is sore. It started a few days ago. It feels tight. after deadlifts. I'd like to keep training if that is sensible. Please keep to general information and tell me when I should get it looked at."
    );
  });

  it("leaves out what was not chosen and returns nothing without an area", () => {
    expect(buildInjuryMessage({ area: "knee", started: null, feel: null, note: "" })).toMatch(/^My knee is sore\. I'd like to keep training/);
    expect(buildInjuryMessage({ area: null, started: "today", feel: "sharp", note: "x" })).toBe("");
    expect(canSubmitIntake({ area: null, started: null, feel: null, note: "" })).toBe(false);
    expect(canSubmitIntake({ area: "hip", started: null, feel: null, note: "" })).toBe(true);
  });

  it("caps a long note and never adds diagnostic wording of its own", () => {
    const msg = buildInjuryMessage({ area: "shoulder", started: "today", feel: "sharp", note: "x".repeat(500) });
    expect(msg.length).toBeLessThan(450);
    expect(msg).not.toMatch(/\b(strain|sprain|tendon|tear|impingement|diagnos)/i);
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
