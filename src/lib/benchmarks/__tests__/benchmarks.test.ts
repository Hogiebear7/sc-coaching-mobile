import { describe, expect, it } from "vitest";

import { BENCHMARK_FIELDS, displayValue, formatDuration, hasAnyBenchmark, parseBenchmarks, parseDuration, parseField, toEngineBenchmarks } from "../index";

const field = (key: string) => BENCHMARK_FIELDS.find((f) => f.key === key)!;

describe("durations", () => {
  it("reads mm:ss, h:mm:ss and plain minutes", () => {
    expect(parseDuration("24:30")).toBe(1470);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("25")).toBe(1500);
  });
  it("rejects nonsense", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("24:75")).toBeNull();
    expect(parseDuration("a:b")).toBeNull();
    expect(parseDuration("1:2:3:4")).toBeNull();
  });
  it("formats", () => {
    expect(formatDuration(1470)).toBe("24:30");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3723)).toBe("1:02:03");
  });
});

describe("parseField", () => {
  it("treats empty as not entered", () => {
    expect(parseField(field("squat5rmKg"), "  ")).toEqual({ value: null, error: null });
  });
  it("rounds kilos to the nearest half and accepts a comma", () => {
    expect(parseField(field("squat5rmKg"), "102,6").value).toBe(102.5);
  });
  it("flags numbers that are probably typos", () => {
    expect(parseField(field("squat5rmKg"), "1000").error).toMatch(/looks off/);
    expect(parseField(field("maxPullUps"), "500").error).toMatch(/looks off/);
    expect(parseField(field("run5kSeconds"), "2:00").error).toMatch(/looks off/);
  });
  it("asks for a number or a time when the text is wrong", () => {
    expect(parseField(field("squat5rmKg"), "heavy").error).toMatch(/enter a number/);
    expect(parseField(field("run5kSeconds"), "fast").error).toMatch(/minutes and seconds/);
  });
  it("reads a plank in mm:ss", () => {
    expect(parseField(field("plankSeconds"), "1:30").value).toBe(90);
  });
});

describe("saved values", () => {
  it("keeps only valid numbers for known fields", () => {
    expect(parseBenchmarks({ squat5rmKg: 100, bench5rmKg: 9999, junk: 1, maxPushUps: "20" })).toEqual({ squat5rmKg: 100 });
    expect(parseBenchmarks(null)).toEqual({});
  });
  it("shows a value the way it was typed", () => {
    expect(displayValue(field("plankSeconds"), 90)).toBe("1:30");
    expect(displayValue(field("squat5rmKg"), 100)).toBe("100");
    expect(displayValue(field("squat5rmKg"), undefined)).toBe("");
  });
  it("passes only the four lifts to the generator, or nothing", () => {
    expect(toEngineBenchmarks({ maxPushUps: 30 })).toBeNull();
    expect(toEngineBenchmarks({ squat5rmKg: 100, maxPushUps: 30 })).toMatchObject({ squat5rmKg: 100 });
    expect(hasAnyBenchmark({})).toBe(false);
    expect(hasAnyBenchmark({ maxPushUps: 30 })).toBe(true);
  });
});
