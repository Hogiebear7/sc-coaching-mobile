import { describe, expect, it } from "vitest";

import {
  bottleDeltaFromDrag,
  clampPending,
  dialDeltaFromDrag,
  formatSignedMl,
  snapToStep,
  totalAfter,
  waterEquivalent,
  WATER_MAX_ML,
} from "../water-adjust";

describe("bottleDeltaFromDrag", () => {
  it("adds when the finger moves up and takes away when it moves down", () => {
    expect(bottleDeltaFromDrag(-75, 150, 2700)).toBe(1350);
    expect(bottleDeltaFromDrag(30, 150, 2700)).toBe(-550);
  });

  it("snaps to 50 ml", () => {
    expect(bottleDeltaFromDrag(-1, 150, 2700)).toBe(0);
    expect(bottleDeltaFromDrag(-2, 150, 2700)).toBe(50);
  });

  it("is zero without a usable bottle or goal", () => {
    expect(bottleDeltaFromDrag(-50, 0, 2700)).toBe(0);
    expect(bottleDeltaFromDrag(-50, 150, 0)).toBe(0);
  });
});

describe("dialDeltaFromDrag", () => {
  it("adds 50 ml for each 12 px down and takes away for up", () => {
    expect(dialDeltaFromDrag(12)).toBe(50);
    expect(dialDeltaFromDrag(60)).toBe(250);
    expect(dialDeltaFromDrag(-24)).toBe(-100);
    expect(dialDeltaFromDrag(5)).toBe(0);
  });
});

describe("totals", () => {
  it("counts a drink at its share of water", () => {
    expect(waterEquivalent(500, 0.8)).toBe(400);
    expect(totalAfter(1000, 500, 0.8)).toBe(1400);
  });

  it("never goes below 0 or above the server limit", () => {
    expect(totalAfter(300, -1000, 1)).toBe(0);
    expect(totalAfter(9800, 1000, 1)).toBe(WATER_MAX_ML);
  });

  it("clamps a pending change to what the total can take, in whole steps", () => {
    expect(clampPending(-2000, 1000, 1)).toBe(-1000);
    expect(clampPending(20000, 1000, 1)).toBe(9000);
    expect(clampPending(150, 1000, 1)).toBe(150);
    // a drink that counts for less needs a bigger amount to reach the same limit
    expect(clampPending(-5000, 800, 0.8)).toBe(-1000);
  });
});

describe("small helpers", () => {
  it("snaps and formats", () => {
    expect(snapToStep(74)).toBe(50);
    expect(snapToStep(76)).toBe(100);
    expect(formatSignedMl(150)).toBe("+150 ml");
    expect(formatSignedMl(-50)).toBe("−50 ml");
    expect(formatSignedMl(0)).toBe("0 ml");
  });
});
