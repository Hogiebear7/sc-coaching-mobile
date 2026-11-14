import { describe, expect, it, vi } from "vitest";

import { formatEntries, turnsFor, type FormatConfigs } from "../format-entries";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

const configs = (): FormatConfigs => ({
  circuit: { stations: [{ key: "a", name: "Burpees", seconds: "40", repTarget: "10" }, { key: "b", name: "", seconds: "40", repTarget: "" }], restBetweenStationsSecs: "15", restBetweenSetsSecs: "60", capMode: "sets", totalSets: "3", timeCapMins: "20" },
  amrap: { timeCapMins: "12", subMode: "rounds", movements: [{ key: "m1", name: "Pull-ups", targetReps: "5", completedReps: 20 }], roundsCompleted: "", extraReps: "" },
  emom: { intervalSecs: "60", totalMins: "10", movements: [{ key: "e1", name: "Kettlebell swings", repsOrTime: "15" }, { key: "e2", name: "Plank", repsOrTime: "40s" }, { key: "e3", name: "Squats", repsOrTime: "12 reps" }] },
  tabata: { workSecs: "20", restSecs: "10", rounds: "8", movements: ["Thrusters", "Rows"] },
  chipper: { movements: [{ key: "c1", name: "Row", mode: "time", targetReps: "", targetSeconds: "240", doneReps: 0, doneSeconds: 251, timerStartedAtMs: null, log: [] }, { key: "c2", name: "Wall balls", mode: "reps", targetReps: "50", targetSeconds: "", doneReps: 50, doneSeconds: 0, timerStartedAtMs: null, log: [] }] },
});

describe("turnsFor", () => {
  it("shares repeating turns between movements", () => {
    expect([0, 1, 2].map((i) => turnsFor(i, 3, 10))).toEqual([4, 3, 3]);
    expect([0, 1].map((i) => turnsFor(i, 2, 8))).toEqual([4, 4]);
    expect(turnsFor(0, 0, 5)).toBe(0);
  });
});

describe("formatEntries", () => {
  it("saves nothing unless the format was run", () => {
    expect(formatEntries("circuit", configs(), false, 200)).toEqual([]);
    expect(formatEntries("standard", configs(), true, 200)).toEqual([]);
  });

  it("circuit: a station per movement with the rounds as sets, skipping blank stations", () => {
    const e = formatEntries("circuit", configs(), true, 200);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ name: "Burpees", sets: 3, reps: 10, weight: "0:40", order: 200 });
    expect(e[0].setDetails).toHaveLength(3);
  });

  it("emom: spreads the minutes across the movements and reads reps or times", () => {
    const e = formatEntries("emom", configs(), true, 200);
    expect(e.map((x) => [x.name, x.sets])).toEqual([["Kettlebell swings", 4], ["Plank", 3], ["Squats", 3]]);
    expect(e[0].reps).toBe(15);
    expect(e[1].weight).toBe("0:40");
    expect(e[2].reps).toBe(12);
  });

  it("tabata: rounds shared between the movements", () => {
    const e = formatEntries("tabata", configs(), true, 0);
    expect(e.map((x) => x.sets)).toEqual([4, 4]);
    expect(e[0].notes).toContain("20s work / 10s rest");
  });

  it("amrap: the reps done per movement", () => {
    const e = formatEntries("amrap", configs(), true, 0);
    expect(e[0]).toMatchObject({ name: "Pull-ups", reps: 20 });
    expect(e[0].notes).toContain("5 per round");
  });

  it("chipper: time or reps done per movement, in order", () => {
    const e = formatEntries("chipper", configs(), true, 10);
    expect(e.map((x) => [x.name, x.weight, x.reps, x.order])).toEqual([["Row", "4:11", null, 10], ["Wall balls", null, 50, 11]]);
  });
});
