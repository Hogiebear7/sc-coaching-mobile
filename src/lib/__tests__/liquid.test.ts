import { describe, expect, it } from "vitest";

import { LIQUID_POINTS, gravityOnScreen, liquidSurface, surfacePath, targetTilt } from "@/lib/liquid";

const W = 84;
const H = 150;
const base = { width: W, height: H, amp: 0, phase: 0 };

function waterAreaShare(ys: number[]): number {
  const mean = ys.reduce((sum, y) => sum + (H - Math.max(0, Math.min(H, y))), 0) / ys.length;
  return mean / H;
}

describe("gravityOnScreen", () => {
  it("flips Android's reading so both platforms agree on which way is down", () => {
    // An upright phone: Android reads +1 on y, iOS reads -1.
    expect(gravityOnScreen(0, 1, "android")).toEqual({ gx: -0, gy: -1 });
    expect(gravityOnScreen(0, -1, "ios")).toEqual({ gx: 0, gy: -1 });
    // Right edge dipped: Android reads negative x, iOS positive; both mean "down is to the right".
    expect(gravityOnScreen(-0.5, 0.8, "android").gx).toBeCloseTo(0.5);
    expect(gravityOnScreen(0.5, -0.8, "ios").gx).toBeCloseTo(0.5);
  });
});

describe("targetTilt", () => {
  it("is level when the phone is upright", () => {
    expect(targetTilt(0, -1)).toBe(0);
  });
  it("leans one way for each edge that dips", () => {
    expect(targetTilt(0.5, -0.85)).toBeGreaterThan(0.3);
    expect(targetTilt(-0.5, -0.85)).toBeLessThan(-0.3);
  });
  it("levels off when the phone is lying flat, and caps a steep tilt", () => {
    expect(targetTilt(0.05, -0.1)).toBe(0);
    expect(targetTilt(1, 0)).toBeCloseTo(1.05);
  });
});

describe("liquidSurface", () => {
  it("is flat when level and calm, with the right amount of water", () => {
    const ys = liquidSurface({ ...base, fillPct: 50, slope: 0 });
    expect(ys).toHaveLength(LIQUID_POINTS);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.01);
    expect(waterAreaShare(ys)).toBeCloseTo(0.5 * 0.94, 1);
  });

  it("shows nothing for an empty bottle, even when it is tilted", () => {
    const ys = liquidSurface({ ...base, fillPct: 0, slope: 1.2 });
    expect(Math.min(...ys)).toBeGreaterThan(H);
  });

  it("raises the side that is lifted, and keeps the amount of water the same", () => {
    const level = liquidSurface({ ...base, fillPct: 60, slope: 0 });
    const tilted = liquidSurface({ ...base, fillPct: 60, slope: 0.6 });
    expect(tilted[tilted.length - 1]).toBeLessThan(tilted[0]); // right side higher (smaller y)
    expect(waterAreaShare(tilted)).toBeCloseTo(waterAreaShare(level), 1);
  });

  it("keeps a little air at the top of a full bottle", () => {
    const ys = liquidSurface({ ...base, fillPct: 100, slope: 0 });
    expect(Math.min(...ys)).toBeGreaterThan(5);
  });

  it("adds a wave that stays inside the bottle", () => {
    const ys = liquidSurface({ ...base, fillPct: 70, slope: 0.4, amp: 5, phase: 2 });
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(5);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(-2);
      expect(y).toBeLessThanOrEqual(H + 2);
    }
  });
});

describe("surfacePath", () => {
  it("closes a shape under the surface", () => {
    const d = surfacePath(W, H, liquidSurface({ ...base, fillPct: 50, slope: 0 }));
    expect(d.startsWith("M -2 152.0 L -2 ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.split("L").length).toBeGreaterThan(LIQUID_POINTS);
  });
});
