import { describe, expect, it } from "vitest";

import { columnLabelAt, columnValue, flingStep, stepTotal, type WheelColumnSpec } from "../wheel-math";

const hours: WheelColumnSpec = { unit: 3600, wrapAt: null };
const minutes: WheelColumnSpec = { unit: 60, wrapAt: 60 };
const seconds: WheelColumnSpec = { unit: 1, wrapAt: 60 };
const MAX = 3 * 3600 + 59 * 60 + 59;

describe("time wheel maths", () => {
  it("shows each column from one running total", () => {
    const t = 1 * 3600 + 5 * 60 + 9;
    expect([columnValue(t, hours), columnValue(t, minutes), columnValue(t, seconds)]).toEqual([1, 5, 9]);
  });

  it("seconds past 59 carry one into the minutes, and minutes past 59 into the hours", () => {
    expect(stepTotal(59, seconds, 1, MAX)).toBe(60); // 0:59 -> 1:00
    expect(columnValue(60, seconds)).toBe(0);
    expect(columnValue(60, minutes)).toBe(1);
    expect(stepTotal(59 * 60, minutes, 1, MAX)).toBe(3600); // 59 min -> 1 h 00 min
    expect(columnValue(3600, hours)).toBe(1);
    expect(columnValue(3600, minutes)).toBe(0);
  });

  it("carries back down the same way", () => {
    expect(stepTotal(60, seconds, -1, MAX)).toBe(59); // 1:00 -> 0:59
    expect(stepTotal(3600, minutes, -1, MAX)).toBe(3540);
  });

  it("refuses to go below zero or past the top", () => {
    expect(stepTotal(0, seconds, -1, MAX)).toBeNull();
    expect(stepTotal(MAX, seconds, 1, MAX)).toBeNull();
    expect(stepTotal(30, minutes, -1, MAX)).toBeNull();
  });

  it("the rows above and below follow the total and go blank past the ends", () => {
    expect(columnLabelAt(60, seconds, -1, MAX)).toBe("59");
    expect(columnLabelAt(60, seconds, 1, MAX)).toBe("01");
    expect(columnLabelAt(0, seconds, -1, MAX)).toBe("");
    expect(columnLabelAt(MAX, seconds, 1, MAX)).toBe("");
  });

  it("a flick slows down: harder flicks go further, and it never speeds up", () => {
    const soft = flingStep(0.01, 16);
    const hard = flingStep(0.05, 16);
    expect(hard.distance).toBeGreaterThan(soft.distance);
    expect(Math.abs(soft.speed)).toBeLessThan(0.01);
    expect(flingStep(-0.02, 16).distance).toBeLessThan(0);
    // Over a whole spin-down the distance is speed x time constant (about 380 ms).
    let speed = 0.05;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const s = flingStep(speed, 16);
      total += s.distance;
      speed = s.speed;
    }
    expect(total).toBeGreaterThan(17);
    expect(total).toBeLessThan(20);
  });
});
