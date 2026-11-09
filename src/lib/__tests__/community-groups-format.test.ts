import { describe, expect, it } from "vitest";

import {
  buildChallengeRows,
  challengeMetricLabel,
  challengeStatusLabel,
  daysBetweenIso,
  extractInviteCode,
  formatChallengeDates,
  formatChallengeValue,
  formatInviteCode,
  groupInviteMessage,
  normaliseInviteCode,
  sortChallenges,
  validateChallengeForm,
} from "@/lib/community-groups-format";
import { hasAccess } from "@/lib/member-access";

describe("access tiers for Community groups and the gym community", () => {
  it("groups need the App tier, the gym community needs a gym Membership", () => {
    expect(hasAccess({ digital: false, gymMembership: false }, "communityGroups")).toBe(false);
    expect(hasAccess({ digital: true, gymMembership: false }, "communityGroups")).toBe(true);
    expect(hasAccess({ digital: false, gymMembership: false }, "communityGym")).toBe(false);
    expect(hasAccess({ digital: true, gymMembership: false }, "communityGym")).toBe(false);
    expect(hasAccess({ digital: false, gymMembership: true }, "communityGym")).toBe(true);
  });
});

describe("challenge labels", () => {
  it("names each metric and status in plain words", () => {
    expect(challengeMetricLabel("volume")).toBe("Total volume");
    expect(challengeMetricLabel("workouts")).toBe("Workouts logged");
    expect(challengeStatusLabel("active")).toBe("Live now");
    expect(challengeStatusLabel("canceled")).toBe("Canceled");
  });

  it("formats scores: kilograms for weights, a count for workouts (singular for one)", () => {
    expect(formatChallengeValue("volume", 12400)).toBe("12,400 kg");
    expect(formatChallengeValue("squat", 140)).toBe("140 kg");
    expect(formatChallengeValue("workouts", 1)).toBe("1 workout");
    expect(formatChallengeValue("workouts", 9)).toBe("9 workouts");
  });
});

describe("formatChallengeDates", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  it("collapses a range inside one month", () => {
    expect(formatChallengeDates("2026-11-03", "2026-11-30", now)).toBe("3 to 30 Nov");
  });
  it("shows both months across a month boundary", () => {
    expect(formatChallengeDates("2026-11-20", "2026-12-18", now)).toBe("20 Nov to 18 Dec");
  });
  it("shows a single day once, and adds the year when it is not this year", () => {
    expect(formatChallengeDates("2026-11-09", "2026-11-09", now)).toBe("9 Nov");
    expect(formatChallengeDates("2027-01-04", "2027-01-31", now)).toBe("4 to 31 Jan 2027");
  });
  it("falls back to the raw text for a malformed date rather than throwing", () => {
    expect(formatChallengeDates("soon", "later", now)).toBe("soon to later");
  });
});

describe("validateChallengeForm (same rules as the server)", () => {
  const today = "2026-11-09";
  const ok = { title: "November volume", startDate: "2026-11-10", endDate: "2026-11-30" };

  it("accepts a normal challenge, including one starting today", () => {
    expect(validateChallengeForm(ok, today)).toBeNull();
    expect(validateChallengeForm({ ...ok, startDate: today }, today)).toBeNull();
  });
  it("needs a title and keeps it within 60 characters", () => {
    expect(validateChallengeForm({ ...ok, title: "   " }, today)).toMatch(/title/i);
    expect(validateChallengeForm({ ...ok, title: "x".repeat(61) }, today)).toMatch(/60/);
    expect(validateChallengeForm({ ...ok, title: "x".repeat(60) }, today)).toBeNull();
  });
  it("refuses a start in the past or more than 60 days ahead", () => {
    expect(validateChallengeForm({ ...ok, startDate: "2026-11-08" }, today)).toMatch(/past/i);
    expect(validateChallengeForm({ ...ok, startDate: "2027-01-09", endDate: "2027-01-20" }, today)).toMatch(/60 days/);
    expect(validateChallengeForm({ ...ok, startDate: "2027-01-08", endDate: "2027-01-20" }, today)).toBeNull();
  });
  it("refuses an end before the start, and a run longer than 90 days", () => {
    expect(validateChallengeForm({ ...ok, endDate: "2026-11-09" }, today)).toMatch(/before/i);
    expect(validateChallengeForm({ ...ok, startDate: "2026-11-10", endDate: "2027-02-07" }, today)).toBeNull(); // exactly 90 days
    expect(validateChallengeForm({ ...ok, startDate: "2026-11-10", endDate: "2027-02-08" }, today)).toMatch(/90 days/);
  });
  it("asks for both dates when one is missing or malformed", () => {
    expect(validateChallengeForm({ ...ok, endDate: "" }, today)).toMatch(/start and end/i);
    expect(validateChallengeForm({ ...ok, startDate: "10/11/2026" }, today)).toMatch(/start and end/i);
  });
});

describe("daysBetweenIso", () => {
  it("counts whole days and returns NaN for bad input", () => {
    expect(daysBetweenIso("2026-11-09", "2026-11-10")).toBe(1);
    expect(daysBetweenIso("2026-11-09", "2026-11-09")).toBe(0);
    expect(daysBetweenIso("2026-10-31", "2026-11-01")).toBe(1);
    expect(Number.isNaN(daysBetweenIso("x", "2026-11-09"))).toBe(true);
  });
});

describe("invite codes", () => {
  it("shows a code as two groups of four", () => {
    expect(formatInviteCode("ABCD2345")).toBe("ABCD-2345");
    expect(formatInviteCode("abcd 2345")).toBe("ABCD-2345");
    expect(formatInviteCode("ABC")).toBe("ABC");
  });
  it("normalises what was typed or pasted the way the server does", () => {
    expect(normaliseInviteCode(" abcd-2345 ")).toBe("ABCD2345");
  });
  it("finds the code inside a pasted invite message or link", () => {
    expect(extractInviteCode("Join my group! Code: ABCD-2345")).toBe("ABCD2345");
    expect(extractInviteCode("https://example.com/join?code=abcd2345")).toBe("ABCD2345");
    expect(extractInviteCode("abcd 2345")).toBe("ABCD2345");
  });
  it("writes an invite message that carries the formatted code and nothing private", () => {
    const text = groupInviteMessage("Sunday Lifters", "ABCD2345");
    expect(text).toContain("Sunday Lifters");
    expect(text).toContain("ABCD-2345");
  });
});

describe("standings rows", () => {
  const entries = [
    { userId: "a", displayName: "Alex M.", value: 120, bodyweightPct: null },
    { userId: "b", displayName: "Alex M.", value: 90, bodyweightPct: null },
    { userId: "me", displayName: "Sam K.", value: 60, bodyweightPct: null },
  ];
  it("keeps the server's order, ranks from 1, and calls the member 'You'", () => {
    const rows = buildChallengeRows(entries, "squat", "me");
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows[2]).toMatchObject({ name: "You", isMe: true, valueLabel: "60 kg" });
  });
  it("never merges two members who share a display name", () => {
    const rows = buildChallengeRows(entries, "squat", "me");
    expect(rows.filter((r) => r.name === "Alex M.")).toHaveLength(2);
  });
  it("labels a workouts challenge in workouts", () => {
    expect(buildChallengeRows([entries[0]], "workouts", null)[0].valueLabel).toBe("120 workouts");
  });
});

describe("sortChallenges", () => {
  it("puts live first, then upcoming, then finished, then canceled; newest start first within a group", () => {
    const sorted = sortChallenges([
      { id: "1", status: "ended" as const, startDate: "2026-09-01" },
      { id: "2", status: "canceled" as const, startDate: "2026-11-01" },
      { id: "3", status: "upcoming" as const, startDate: "2026-12-01" },
      { id: "4", status: "active" as const, startDate: "2026-11-01" },
      { id: "5", status: "active" as const, startDate: "2026-11-05" },
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["5", "4", "3", "1", "2"]);
  });
});
