import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => {} }) } }));

import { localDayKey, msUntilNextLocalMidnight } from "../day-key";

describe("localDayKey", () => {
  it("formats the local date with zero padding", () => {
    expect(localDayKey(new Date(2026, 10, 5, 23, 59))).toBe("2026-11-05");
    expect(localDayKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it("changes at local midnight, not before", () => {
    expect(localDayKey(new Date(2026, 10, 11, 23, 59, 59))).toBe("2026-11-11");
    expect(localDayKey(new Date(2026, 10, 12, 0, 0, 0))).toBe("2026-11-12");
  });
});

describe("msUntilNextLocalMidnight", () => {
  it("counts to one second past the next midnight", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 11, 23, 0, 0))).toBe(60 * 60 * 1000 + 1000);
  });

  it("crosses month and year ends", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 11, 31, 23, 59, 0))).toBe(61 * 1000);
  });

  it("is never less than a second", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 11, 23, 59, 59, 999))).toBeGreaterThanOrEqual(1000);
  });
});
