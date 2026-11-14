import { describe, expect, it } from "vitest";

import { defaultHyroxConfig, emptyHyroxSession, hyroxClock, hyroxEntries, hyroxLap, hyroxPause, hyroxResult, hyroxSegments, hyroxSplits, hyroxStart, hyroxSummaryNote, hyroxUndoLap, HYROX_LAPS } from "../hyrox";

describe("hyrox course", () => {
  it("is 8 stations each with a run before it, 16 laps in all, with the fixed stations", () => {
    const segs = hyroxSegments(defaultHyroxConfig());
    expect(segs).toHaveLength(HYROX_LAPS);
    expect(segs.map((s) => s.kind)).toEqual(Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? "run" : "station")));
    expect(segs[0].title).toBe("Run 1");
    expect(segs[1].title).toBe("SkiErg");
    expect(segs[1].detail).toBe("1000 m");
    expect(segs[3].detail).toBe("50 m · 125 kg");
    expect(segs[5].detail).toBe("50 m · 75 kg");
    expect(segs[15].detail).toBe("100 reps · 6 kg");
  });

  it("picks up edited distances and weights, and a different run length", () => {
    const c = defaultHyroxConfig();
    c.runDistanceM = "800";
    c.stations[1].amount = "25";
    c.stations[1].weightKg = "102";
    const segs = hyroxSegments(c);
    expect(segs[0].detail).toBe("800 m");
    expect(segs[3].detail).toBe("25 m · 102 kg");
  });
});

describe("hyrox timing", () => {
  it("counts the overall time and splits it into laps", () => {
    let s = hyroxStart(emptyHyroxSession(), 1_000_000);
    s = hyroxLap(s, 1_000_000 + 285_000); // run 1 in 4:45
    s = hyroxLap(s, 1_000_000 + 575_000); // skierg in 4:50
    expect(hyroxSplits(s)).toEqual([285, 290]);
    expect(s.finished).toBe(false);
  });

  it("does not lose time over a pause", () => {
    let s = hyroxStart(emptyHyroxSession(), 0);
    s = hyroxPause(s, 60_000);
    s = hyroxStart(s, 500_000);
    s = hyroxLap(s, 530_000);
    expect(s.lapTotals).toEqual([90]);
  });

  it("finishes on the 16th lap and stops the clock", () => {
    let s = hyroxStart(emptyHyroxSession(), 0);
    for (let i = 1; i <= 16; i++) s = hyroxLap(s, i * 100_000);
    expect(s.finished).toBe(true);
    expect(s.startedAtMs).toBeNull();
    expect(hyroxResult(s).total).toBe(1600);
    expect(hyroxLap(s, 9_999_999)).toBe(s);
  });

  it("takes a lap back, including the last one", () => {
    let s = hyroxStart(emptyHyroxSession(), 0);
    for (let i = 1; i <= 16; i++) s = hyroxLap(s, i * 100_000);
    const back = hyroxUndoLap(s, 5_000_000);
    expect(back.finished).toBe(false);
    expect(back.lapTotals).toHaveLength(15);
    expect(back.startedAtMs).toBe(5_000_000);
  });

  it("gives run totals and the best run lap", () => {
    let s = hyroxStart(emptyHyroxSession(), 0);
    const ends = [285, 575, 881, 1059, 1382, 1613, 1936, 2205];
    ends.forEach((t) => (s = hyroxLap(s, t * 1000)));
    const r = hyroxResult(s);
    expect(r.bestRun).toBe(285);
    expect(r.runTotal).toBe(285 + (881 - 575) + (1382 - 1059) + (1936 - 1613));
    expect(hyroxSummaryNote(s)).toContain("8/16 laps");
  });

  it("formats clocks", () => {
    expect(hyroxClock(285)).toBe("4:45");
    expect(hyroxClock(2641)).toBe("44:01");
    expect(hyroxClock(3725)).toBe("1:02:05");
  });
});

describe("hyrox saved entries", () => {
  it("makes cardio runs and station exercises in race order, only for finished laps", () => {
    const c = defaultHyroxConfig();
    let s = hyroxStart(emptyHyroxSession(), 0);
    [285, 575, 881].forEach((t) => (s = hyroxLap(s, t * 1000)));
    const e = hyroxEntries(c, s, 100);
    expect(e.runs.map((r) => [r.order, r.durationSecs, r.distance])).toEqual([[100, 285, 1], [102, 306, 1]]);
    expect(e.stations).toHaveLength(1);
    expect(e.stations[0].name).toBe("1000 m SkiErg");
    expect(e.stations[0].order).toBe(101);
    expect(e.stations[0].notes).toBe("Hyrox station 1: 4:50");
  });

  it("keeps the weight and reps on the sled and the wall balls", () => {
    const c = defaultHyroxConfig();
    let s = hyroxStart(emptyHyroxSession(), 0);
    for (let i = 1; i <= 16; i++) s = hyroxLap(s, i * 100_000);
    const e = hyroxEntries(c, s, 0);
    expect(e.stations[1].name).toBe("50 m Sled Push");
    expect(e.stations[1].weight).toBe("125 kg");
    expect(e.stations[7].name).toBe("100 Wall Balls");
    expect(e.stations[7].reps).toBe(100);
    expect(e.stations[7].weight).toBe("6 kg");
  });
});

import { hyroxRoxzoneToggle, roxzoneElapsed } from "../hyrox";

describe("roxzone", () => {
  it("adds up the time spent in the zones, separately from the laps", () => {
    let s = hyroxStart(emptyHyroxSession(), 0);
    s = hyroxRoxzoneToggle(s, 10_000);
    s = hyroxRoxzoneToggle(s, 40_000);
    s = hyroxRoxzoneToggle(s, 100_000);
    expect(roxzoneElapsed(s, 120_000)).toBe(50);
    s = hyroxRoxzoneToggle(s, 160_000);
    expect(s.roxzoneSecs).toBe(90);
    expect(s.lapTotals).toEqual([]);
  });

  it("stops when the race is paused or finishes, and cannot start before the race does", () => {
    expect(hyroxRoxzoneToggle(emptyHyroxSession(), 5_000).roxzoneStartedAtMs).toBeNull();
    let s = hyroxStart(emptyHyroxSession(), 0);
    s = hyroxRoxzoneToggle(s, 10_000);
    s = hyroxPause(s, 25_000);
    expect(s.roxzoneStartedAtMs).toBeNull();
    expect(s.roxzoneSecs).toBe(15);
    s = hyroxStart(s, 30_000);
    s = hyroxRoxzoneToggle(s, 31_000);
    for (let i = 1; i <= 16; i++) s = hyroxLap(s, 31_000 + i * 100_000);
    expect(s.roxzoneStartedAtMs).toBeNull();
    expect(hyroxResult(s).roxzone).toBeGreaterThan(15);
    expect(hyroxSummaryNote(s)).toContain("Roxzone");
  });
});
