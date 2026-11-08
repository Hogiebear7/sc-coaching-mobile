import { describe, expect, it } from "vitest";

import {
  daysBetween,
  formatDueDate,
  pregnancyDay,
  PREGNANCY_TOTAL_DAYS,
  sinceBirthLabel,
  toGoLabel,
  TRIMESTER_SEGMENTS,
  weekDayLabel,
} from "../pregnancy-view";

describe("pregnancyDay", () => {
  it("is 280 days before the due date at the start, and 0 days to go at the end", () => {
    expect(pregnancyDay("2027-03-10", "2026-06-03")).toMatchObject({ day: 0, weeks: 0, days: 0, daysToGo: 280, progress: 0 });
    expect(pregnancyDay("2027-03-10", "2027-03-10")).toMatchObject({ day: 280, weeks: 40, daysToGo: 0, progress: 1 });
  });

  it("counts weeks and days into the week (day 172 = 24 weeks and 4 days, shown as week 25 day 5)", () => {
    const p = pregnancyDay("2027-03-10", "2026-11-22");
    expect(p).toMatchObject({ day: 172, weeks: 24, days: 4, daysToGo: 108 });
    expect(weekDayLabel(p!)).toBe("Week 25 · day 5");
  });

  it("clamps: before the start is day 0, past the due date is day 280 with no days to go", () => {
    expect(pregnancyDay("2027-03-10", "2026-01-01")).toMatchObject({ day: 0, progress: 0 });
    expect(pregnancyDay("2027-03-10", "2027-03-20")).toMatchObject({ day: PREGNANCY_TOTAL_DAYS, daysToGo: 0, progress: 1 });
  });

  it("is null without a usable due date", () => {
    expect(pregnancyDay(null, "2026-11-08")).toBeNull();
    expect(pregnancyDay("soon", "2026-11-08")).toBeNull();
    expect(pregnancyDay("2027-03-10", "nope")).toBeNull();
  });

  it("is not thrown off by month ends, leap days or the clock change", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("labels", () => {
  it("says how long is left in plain words", () => {
    const at = (today: string) => toGoLabel(pregnancyDay("2027-03-10", today)!);
    expect(at("2027-03-10")).toBe("Due today");
    expect(at("2027-03-09")).toBe("1 day to go");
    expect(at("2027-03-01")).toBe("9 days to go");
    expect(at("2026-12-10")).toBe("13 weeks to go");
  });

  it("describes the time since a birth, and is quiet for a date in the future", () => {
    expect(sinceBirthLabel("2026-11-05", "2026-11-08")).toBe("Newly arrived");
    expect(sinceBirthLabel("2026-11-01", "2026-11-08")).toBe("1 week since the birth");
    expect(sinceBirthLabel("2026-10-01", "2026-11-08")).toBe("5 weeks since the birth");
    expect(sinceBirthLabel("2026-12-01", "2026-11-08")).toBeNull();
    expect(sinceBirthLabel(null, "2026-11-08")).toBeNull();
  });

  it("formats the due date and leaves an unreadable one alone", () => {
    expect(formatDueDate("2027-03-10")).toBe("10 Mar 2027");
    expect(formatDueDate("later")).toBe("later");
    expect(formatDueDate(null)).toBeNull();
  });
});

describe("trimester bar", () => {
  it("covers the whole 40 weeks with the same boundaries the server uses (week 14 and week 28)", () => {
    expect(TRIMESTER_SEGMENTS.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(TRIMESTER_SEGMENTS[0] * 40).toBe(14);
    expect((TRIMESTER_SEGMENTS[0] + TRIMESTER_SEGMENTS[1]) * 40).toBe(28);
  });
});
