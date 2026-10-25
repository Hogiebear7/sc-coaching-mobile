import { describe, expect, it } from "vitest";

import { shouldSuggestTrainingSplit } from "@/lib/training-tip";

const TODAY = "2026-10-28"; // Wednesday; last three full weeks start Oct 5, 12, 19

function weeks(perWeek: number[]): string[] {
  const starts = ["2026-10-19", "2026-10-12", "2026-10-05"];
  return starts.flatMap((start, i) =>
    Array.from({ length: perWeek[i] }, (_, j) => {
      const d = new Date(`${start}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + j);
      return d.toISOString().slice(0, 10);
    })
  );
}

describe("shouldSuggestTrainingSplit", () => {
  it("suggests after three weeks of 3+ sessions on even calories", () => {
    expect(shouldSuggestTrainingSplit({ sessionDates: weeks([3, 4, 3]), today: TODAY, distribution: "even", locked: false })).toBe(true);
  });
  it("waits while any of the three weeks is light", () => {
    expect(shouldSuggestTrainingSplit({ sessionDates: weeks([3, 2, 5]), today: TODAY, distribution: "even", locked: false })).toBe(false);
  });
  it("ignores the current, unfinished week", () => {
    const thisWeek = ["2026-10-26", "2026-10-27", "2026-10-28"];
    expect(
      shouldSuggestTrainingSplit({ sessionDates: [...thisWeek, ...weeks([3, 3, 2])], today: TODAY, distribution: "even", locked: false })
    ).toBe(false);
  });
  it("never suggests to someone already on training, locked, or on a pre-v2 server", () => {
    const busy = weeks([4, 4, 4]);
    expect(shouldSuggestTrainingSplit({ sessionDates: busy, today: TODAY, distribution: "training", locked: false })).toBe(false);
    expect(shouldSuggestTrainingSplit({ sessionDates: busy, today: TODAY, distribution: "even", locked: true })).toBe(false);
    expect(shouldSuggestTrainingSplit({ sessionDates: busy, today: TODAY, distribution: undefined, locked: false })).toBe(false);
  });
});
