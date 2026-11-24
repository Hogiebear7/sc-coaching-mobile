import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(() => Promise.resolve(null)), setItem: vi.fn(() => Promise.resolve()) } }));

import { buildClassData, buildNutritionData, buildWaterData, describeClassTime, describeCountdown, progress, waterToSync } from "../widgets/snapshot";
import { validWaterAmount, waterChipLabel, waterQuickAdds } from "../water-amount";

const NOW = new Date(2026, 9, 30, 12, 0);

describe("widget snapshot", () => {
  it("water uses the member's own amount for the + button", () => {
    expect(buildWaterData("2026-10-30", { loggedMl: 1250.4, targetMl: 2800 }, 330)).toEqual({ date: "2026-10-30", loggedMl: 1250, targetMl: 2800, amountMl: 330 });
    expect(buildWaterData("2026-10-30", undefined, 250)).toBeNull();
  });

  it("nutrition shows targets only when there are any (Free has none)", () => {
    expect(buildNutritionData("2026-10-30", { calories: 1520.6, proteinG: 98.2 }, null)).toMatchObject({ calories: 1521, targetCalories: null, proteinG: 98 });
    expect(buildNutritionData("2026-10-30", { calories: 1500, proteinG: 100 }, { calories: 2400, proteinG: 160 })).toMatchObject({ targetCalories: 2400, targetProteinG: 160 });
  });

  it("next class is the soonest booking still ahead; classes left only on a class-pack plan", () => {
    const data = buildClassData(
      {
        remainingSessions: 3,
        noActiveMembership: false,
        upcomingBookings: [
          { title: "Over 50s", date: "2026-11-02", startTime: "10:00" },
          { title: "Earlier today", date: "2026-10-30", startTime: "09:00" },
          { title: "Over 50s", date: "2026-10-31", startTime: "10:00" },
        ],
      },
      NOW
    );
    expect(data).toEqual({ next: { title: "Over 50s", date: "2026-10-31", startTime: "10:00" }, classesLeft: 3, canBook: true, countdown: { value: 22, unit: "hrs to go" }, checkinDue: true });
    expect(buildClassData({ remainingSessions: null, noActiveMembership: true, upcomingBookings: [] }, NOW)).toEqual({ next: null, classesLeft: null, canBook: false, countdown: null, checkinDue: false });
  });

  it("counts down to the next class and flags a check-in before it", () => {
    const sched = { remainingSessions: null, noActiveMembership: false, upcomingBookings: [{ title: "Friday Class", date: "2026-10-31", startTime: "11:00" }] };
    expect(buildClassData(sched, NOW)?.checkinDue).toBe(true);
    expect(buildClassData(sched, NOW, true)?.checkinDue).toBe(false);
    expect(describeCountdown("2026-10-30", "12:30", NOW)).toEqual({ value: 30, unit: "mins to go" });
    expect(describeCountdown("2026-11-04", "10:00", NOW)).toEqual({ value: 5, unit: "days to go" });
    expect(describeCountdown("2026-10-30", "09:00", NOW)).toBeNull();
  });

  it("describes the class time in plain words", () => {
    expect(describeClassTime("2026-10-30", "18:30", NOW)).toBe("Today 18:30");
    expect(describeClassTime("2026-10-31", "07:00", NOW)).toBe("Tomorrow 07:00");
    expect(describeClassTime("2026-11-04", "09:15", NOW)).toMatch(/4 Nov, 09:15$/);
  });

  it("progress is clamped and 0 without a target", () => {
    expect(progress(1500, 3000)).toBe(0.5);
    expect(progress(4000, 3000)).toBe(1);
    expect(progress(500, null)).toBe(0);
  });
});

describe("water added from the widget", () => {
  it("sends only what hasn't been sent for that day, so nothing is added twice", () => {
    expect(waterToSync({ date: "2026-10-30", widgetAddedMl: 750 }, null)).toEqual({ date: "2026-10-30", deltaMl: 750 });
    expect(waterToSync({ date: "2026-10-30", widgetAddedMl: 750 }, { date: "2026-10-30", syncedMl: 500 })).toEqual({ date: "2026-10-30", deltaMl: 250 });
    expect(waterToSync({ date: "2026-10-30", widgetAddedMl: 750 }, { date: "2026-10-30", syncedMl: 750 })).toBeNull();
    expect(waterToSync({ date: "2026-10-31", widgetAddedMl: 250 }, { date: "2026-10-30", syncedMl: 750 })).toEqual({ date: "2026-10-31", deltaMl: 250 });
    expect(waterToSync(null, null)).toBeNull();
  });
});

describe("water amount", () => {
  it("accepts a whole number of ml in range", () => {
    expect(validWaterAmount("330")).toBe(330);
    expect(validWaterAmount(49)).toBeNull();
    expect(validWaterAmount("abc")).toBeNull();
    expect(validWaterAmount(2001)).toBeNull();
  });

  it("labels a litre as 1L", () => {
    expect(waterChipLabel(1000)).toBe("+1L");
    expect(waterChipLabel(250)).toBe("+250ml");
  });

  it("puts the member's amount first on the Hydration card without repeating a size", () => {
    expect(waterQuickAdds(250)).toEqual([250, 500, 1000]);
    expect(waterQuickAdds(330)).toEqual([330, 250, 500]);
    expect(waterQuickAdds(500)).toEqual([500, 250, 1000]);
    expect(waterQuickAdds(750)).toEqual([750, 250, 500]);
  });
});

import { mergeSnapshot } from "../widgets/snapshot";

describe("widget updates never blank real numbers", () => {
  it("keeps a section the widget already shows while the new data for it is still loading", () => {
    const water = { date: "2026-10-31", loggedMl: 500, targetMl: 2800, amountMl: 250 };
    const prev = { updatedAt: "a", style: "navy" as const, water, nutrition: null, classes: null };
    const next = { updatedAt: "b", style: "glass" as const, water: null, nutrition: null, classes: { next: null, classesLeft: null, canBook: true, countdown: null, checkinDue: false } };
    expect(mergeSnapshot(prev, next)).toEqual({ ...next, water });
    expect(mergeSnapshot(null, next)).toBe(next);
  });
});
