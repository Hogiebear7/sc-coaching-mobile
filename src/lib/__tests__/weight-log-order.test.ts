import { describe, expect, it } from "vitest";

import type { BodyWeightLog } from "@/lib/queries/body-weight";
import { compareWeightLogs } from "@/lib/weight-logs";

const log = (date: string, createdAt: string, weightKg: number): BodyWeightLog => ({ id: createdAt, userId: "u", date, weightKg, createdAt });

describe("compareWeightLogs", () => {
  const morning = log("2026-10-27", "2026-10-27T07:00:00.000Z", 82.4);
  const evening = log("2026-10-27", "2026-10-27T19:00:00.000Z", 81.9);
  const yesterday = log("2026-10-26", "2026-10-26T08:00:00.000Z", 82.8);

  it("orders by date, then by when the entry was logged", () => {
    expect([evening, yesterday, morning].sort(compareWeightLogs)).toEqual([yesterday, morning, evening]);
  });

  it("the latest entry of the day comes first when sorted newest first", () => {
    // The server lists a day's entries oldest first; the newest must still win.
    expect([morning, evening, yesterday].sort((a, b) => compareWeightLogs(b, a))[0]).toBe(evening);
  });
});
