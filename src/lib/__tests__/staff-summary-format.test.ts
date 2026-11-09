import { describe, expect, it } from "vitest";

import {
  bookOutcomeTitle,
  bookableMembers,
  checkInStats,
  classStats,
  memberStateLabel,
  memberStateTone,
  nutritionStats,
  trainingStats,
  upcomingClassesLine,
  weightStats,
} from "@/lib/staff-summary-format";
import type { StaffClassSummary, StaffMemberSummary } from "@/lib/queries/staff";
import type { MemberSummary } from "@/lib/queries/staff-community";

const training: MemberSummary["training"] = {
  daysTrainedLast7: 1,
  daysTrainedLast30: 9,
  targetDaysPerWeek: 3,
  lastSessionDate: "2026-11-08",
  daysSinceLastSession: 1,
  effortLast3Days: "hard",
  averageSessionRpeLast7: 8.5,
  volumeLast7Kg: 12400,
  averageWeeklyVolumePrev4WeeksKg: 9000,
  totalLogged: 40,
  recent: [],
};

describe("member state", () => {
  it("names and colours each state", () => {
    expect(memberStateLabel("good")).toBe("In good shape");
    expect(memberStateLabel("caution")).toBe("Needs attention");
    expect(memberStateLabel("no_recent_data")).toBe("Nothing logged recently");
    expect(memberStateTone("good")).toBe("good");
    expect(memberStateTone("take_care")).toBe("warn");
    expect(memberStateTone("caution")).toBe("bad");
    expect(memberStateTone("no_recent_data")).toBe("quiet");
  });
});

describe("trainingStats", () => {
  it("reads naturally, with the target and the usual week as hints", () => {
    const stats = trainingStats(training);
    expect(stats[0]).toEqual({ label: "Last 7 days", value: "1 day", hint: "target 3 a week" });
    expect(stats.find((s) => s.label === "Volume this week")).toEqual({ label: "Volume this week", value: "12,400 kg", hint: "usual week 9,000 kg" });
    expect(stats.find((s) => s.label === "Last session")?.hint).toBe("1 day ago");
    expect(stats.find((s) => s.label === "Effort, last 3 days")).toMatchObject({ value: "hard", hint: "avg RPE 8.5 this week" });
  });
  it("shows rest, not 'none', and does not invent a hint when there is no data", () => {
    const stats = trainingStats({ ...training, effortLast3Days: "none", averageSessionRpeLast7: null, targetDaysPerWeek: null, lastSessionDate: null, daysSinceLastSession: null, daysTrainedLast7: 3 });
    expect(stats.find((s) => s.label === "Effort, last 3 days")).toMatchObject({ value: "rest", hint: undefined });
    expect(stats[0]).toMatchObject({ value: "3 days", hint: undefined });
    expect(stats.find((s) => s.label === "Last session")).toMatchObject({ value: "none logged", hint: undefined });
  });
});

describe("checkInStats", () => {
  it("shows n/a rather than a made-up zero when nothing was logged", () => {
    const stats = checkInStats({ checkInsLast14: 0, latestDate: null, averageReadiness: null, readinessTrend: null, averageSleepHours: null, averageSoreness: null, averageFatigue: null, healthNote: null });
    expect(stats[0]).toMatchObject({ value: "0 check-ins", hint: undefined });
    expect(stats[1].value).toBe("n/a");
    expect(stats[3].value).toBe("n/a · n/a");
  });
  it("includes the trend when there is one", () => {
    const stats = checkInStats({ checkInsLast14: 1, latestDate: "2026-11-08", averageReadiness: 72, readinessTrend: "declining", averageSleepHours: 6.5, averageSoreness: 4, averageFatigue: 3, healthNote: null });
    expect(stats[0].value).toBe("1 check-in");
    expect(stats[1]).toMatchObject({ value: "72/100", hint: "trend: declining" });
    expect(stats[3].value).toBe("4/10 · 3/5");
  });
});

describe("nutritionStats", () => {
  it("says 'not logged' for missing food or water, never zero", () => {
    const stats = nutritionStats({ daysLoggedLast3: 0, daysLoggedLast7: 1, averageCalories: null, caloriePercentOfTarget: null, targetCalories: 2200, averageProteinG: null, proteinPercentOfTarget: null, averageWaterMl: null });
    expect(stats[0]).toMatchObject({ value: "0 of 3", hint: "1 of the last 7" });
    expect(stats[1]).toMatchObject({ value: "not logged", hint: "target 2200" });
    expect(stats[3].value).toBe("not logged");
  });
  it("shows percentages of target and litres of water", () => {
    const stats = nutritionStats({ daysLoggedLast3: 3, daysLoggedLast7: 6, averageCalories: 2100, caloriePercentOfTarget: 95, targetCalories: 2200, averageProteinG: 150, proteinPercentOfTarget: 100, averageWaterMl: 2250 });
    expect(stats[1]).toMatchObject({ value: "2100 kcal", hint: "95% of target" });
    expect(stats[3].value).toBe("2.3 L a day");
  });
});

describe("weightStats", () => {
  it("signs changes and says how far to the goal", () => {
    const stats = weightStats({ latestKg: 82.4, latestDate: "2026-11-08", changeLast30DaysKg: -1.2, changeLast90DaysKg: 0.5, weighInsLast90: 1, goalWeightKg: 80, kgToGoal: -2.4, goalTargetDate: "2027-02-01" });
    expect(stats[1].value).toBe("-1.2 kg");
    expect(stats[2]).toMatchObject({ value: "+0.5 kg", hint: "1 weigh-in" });
    expect(stats[3]).toMatchObject({ value: "80 kg", hint: "-2.4 kg to go by 2027-02-01" });
  });
});

describe("classStats and the next-classes line", () => {
  it("counts attendance and lists what is booked next", () => {
    const classes = { bookedLast30: 8, attendedLast30: 6, missedLast30: 2, lastAttendedDate: "2026-11-05", upcoming: [{ title: "Strength", date: "2026-11-12", startTime: "18:00" }] };
    expect(classStats(classes).map((s) => s.value)).toEqual(["8", "6", "2", "2026-11-05"]);
    expect(upcomingClassesLine(classes.upcoming)).toBe("Next: Strength (2026-11-12 18:00)");
    expect(upcomingClassesLine([])).toBeNull();
  });
});

function member(over: Partial<StaffMemberSummary> & { userId: string }): StaffMemberSummary {
  return {
    email: `${over.userId}@example.com`,
    fullName: null,
    phone: null,
    joinedAt: "2026-01-01",
    archivedAt: null,
    currentPlanName: null,
    currentStatus: null,
    ...over,
  };
}

describe("bookableMembers", () => {
  const members = [
    member({ userId: "zed", fullName: "Zed Past", membershipGroup: "past" }),
    member({ userId: "bea", fullName: "Bea Current", membershipGroup: "current" }),
    member({ userId: "al", fullName: "Al Current", membershipGroup: "current", phone: "083 123 4567" }),
    member({ userId: "pat", fullName: "Pat Paused", membershipGroup: "paused" }),
    member({ userId: "gone", fullName: "Gone Archived", membershipGroup: "current", archivedAt: "2026-10-01" }),
    member({ userId: "on", fullName: "On Roster", membershipGroup: "current" }),
  ];
  const cls = { roster: [{ bookingId: "b1", userId: "on", email: "on@example.com", fullName: "On Roster", attendedAt: null }] } as Pick<StaffClassSummary, "roster">;

  it("leaves out archived members and anyone already booked in", () => {
    const ids = bookableMembers(members, cls, "").map((m) => m.userId);
    expect(ids).not.toContain("gone");
    expect(ids).not.toContain("on");
  });
  it("lists current members first, then paused, then the rest, alphabetically within each", () => {
    expect(bookableMembers(members, cls, "").map((m) => m.userId)).toEqual(["al", "bea", "pat", "zed"]);
  });
  it("searches by name, email or phone (ignoring spaces)", () => {
    expect(bookableMembers(members, cls, "bea").map((m) => m.userId)).toEqual(["bea"]);
    expect(bookableMembers(members, cls, "PAT@EXAMPLE").map((m) => m.userId)).toEqual(["pat"]);
    expect(bookableMembers(members, cls, "0831234567").map((m) => m.userId)).toEqual(["al"]);
    expect(bookableMembers(members, cls, "nobody")).toEqual([]);
  });
});

describe("bookOutcomeTitle", () => {
  it("tells a booking from a waitlist place", () => {
    expect(bookOutcomeTitle("booked")).toBe("Booked in");
    expect(bookOutcomeTitle("waitlisted")).toBe("Added to the waitlist");
  });
});
