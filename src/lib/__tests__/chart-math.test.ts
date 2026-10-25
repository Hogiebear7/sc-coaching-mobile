import { describe, expect, it } from "vitest";

import { smoothTrend } from "@/lib/chart-math";

describe("smoothTrend", () => {
  it("is empty for no readings", () => {
    expect(smoothTrend([])).toEqual([]);
  });

  it("seeds with the first reading", () => {
    expect(smoothTrend([80])).toEqual([80]);
  });

  it("moves a tenth of the way toward each new reading", () => {
    expect(smoothTrend([80, 90])).toEqual([80, 81]);
  });

  it("damps a one-day spike", () => {
    const t = smoothTrend([80, 80, 77, 80, 80]);
    expect(Math.min(...t)).toBeGreaterThan(79.6);
  });
});
