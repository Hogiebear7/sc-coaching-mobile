import type { BookOutcome, MemberState, MemberSummary } from "@/lib/queries/staff-community";
import type { StaffClassSummary, StaffMemberSummary } from "@/lib/queries/staff";

// Plain-text helpers for the staff member summary, the class brief and the "book a member" picker. Free of React so they can be tested directly. Everything a
// stat shows is worked out on the server from what the member logs, so "not logged" means a gap in what they logged, not that things are fine.

const STATE_LABEL: Record<MemberState, string> = {
  good: "In good shape",
  take_care: "Take care",
  caution: "Needs attention",
  no_recent_data: "Nothing logged recently",
};

export type StateTone = "good" | "warn" | "bad" | "quiet";
const STATE_TONE: Record<MemberState, StateTone> = { good: "good", take_care: "warn", caution: "bad", no_recent_data: "quiet" };

export const memberStateLabel = (state: MemberState): string => STATE_LABEL[state] ?? "Unknown";
export const memberStateTone = (state: MemberState): StateTone => STATE_TONE[state] ?? "quiet";

export interface Stat {
  label: string;
  value: string;
  hint?: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const num = (n: number | null, unit = "") => (n === null ? "n/a" : `${n}${unit}`);
const kg = (n: number | null) => (n === null ? "n/a" : `${n} kg`);
const signedKg = (n: number | null) => (n === null ? "n/a" : `${n > 0 ? "+" : ""}${n} kg`);
const thousands = (n: number) => n.toLocaleString("en-IE");

export function trainingStats(s: MemberSummary["training"]): Stat[] {
  return [
    {
      label: "Last 7 days",
      value: plural(s.daysTrainedLast7, "day"),
      hint: s.targetDaysPerWeek ? `target ${s.targetDaysPerWeek} a week` : undefined,
    },
    { label: "Last 30 days", value: plural(s.daysTrainedLast30, "day") },
    {
      label: "Last session",
      value: s.lastSessionDate ?? "none logged",
      hint: s.daysSinceLastSession !== null ? `${s.daysSinceLastSession} ${s.daysSinceLastSession === 1 ? "day" : "days"} ago` : undefined,
    },
    {
      label: "Effort, last 3 days",
      value: s.effortLast3Days === "none" ? "rest" : s.effortLast3Days,
      hint: s.averageSessionRpeLast7 !== null ? `avg RPE ${s.averageSessionRpeLast7} this week` : undefined,
    },
    {
      label: "Volume this week",
      value: `${thousands(s.volumeLast7Kg)} kg`,
      hint: `usual week ${thousands(s.averageWeeklyVolumePrev4WeeksKg)} kg`,
    },
    { label: "Sessions logged", value: String(s.totalLogged) },
  ];
}

export function checkInStats(s: MemberSummary["checkIns"]): Stat[] {
  return [
    { label: "Last 14 days", value: plural(s.checkInsLast14, "check-in"), hint: s.latestDate ? `latest ${s.latestDate}` : undefined },
    { label: "Readiness", value: num(s.averageReadiness, "/100"), hint: s.readinessTrend ? `trend: ${s.readinessTrend}` : undefined },
    { label: "Sleep", value: num(s.averageSleepHours, " h") },
    { label: "Soreness / fatigue", value: `${num(s.averageSoreness, "/10")} · ${num(s.averageFatigue, "/5")}` },
  ];
}

export function nutritionStats(s: MemberSummary["nutrition"]): Stat[] {
  return [
    { label: "Days food logged", value: `${s.daysLoggedLast3} of 3`, hint: `${s.daysLoggedLast7} of the last 7` },
    {
      label: "Calories",
      value: s.averageCalories === null ? "not logged" : `${s.averageCalories} kcal`,
      hint: s.caloriePercentOfTarget !== null ? `${s.caloriePercentOfTarget}% of target` : s.targetCalories ? `target ${s.targetCalories}` : undefined,
    },
    {
      label: "Protein",
      value: s.averageProteinG === null ? "not logged" : `${s.averageProteinG} g`,
      hint: s.proteinPercentOfTarget !== null ? `${s.proteinPercentOfTarget}% of target` : undefined,
    },
    { label: "Water", value: s.averageWaterMl === null ? "not logged" : `${(s.averageWaterMl / 1000).toFixed(1)} L a day` },
  ];
}

export function weightStats(s: MemberSummary["weight"]): Stat[] {
  return [
    { label: "Latest", value: kg(s.latestKg), hint: s.latestDate ?? undefined },
    { label: "Change, 30 days", value: signedKg(s.changeLast30DaysKg) },
    { label: "Change, 90 days", value: signedKg(s.changeLast90DaysKg), hint: plural(s.weighInsLast90, "weigh-in") },
    {
      label: "Goal",
      value: kg(s.goalWeightKg),
      hint: s.kgToGoal !== null ? `${signedKg(s.kgToGoal)} to go${s.goalTargetDate ? ` by ${s.goalTargetDate}` : ""}` : undefined,
    },
  ];
}

export function classStats(s: MemberSummary["classes"]): Stat[] {
  return [
    { label: "Booked, 30 days", value: String(s.bookedLast30) },
    { label: "Attended", value: String(s.attendedLast30) },
    { label: "Missed", value: String(s.missedLast30) },
    { label: "Last attended", value: s.lastAttendedDate ?? "none yet" },
  ];
}

/** "Next: Strength (2026-11-12 18:00) · Mobility (2026-11-14 09:30)", or null when nothing is booked. */
export function upcomingClassesLine(upcoming: MemberSummary["classes"]["upcoming"]): string | null {
  if (upcoming.length === 0) return null;
  return `Next: ${upcoming.map((c) => `${c.title} (${c.date} ${c.startTime})`).join(" · ")}`;
}

// ── Booking a member into a class ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Members a coach can pick for a class: not archived, not already on that class's roster, and matching what they typed (name, email or phone). Current
 * members come first, then the rest alphabetically. The server still applies every booking rule (active membership, emergency contact, plan eligibility,
 * allowance, capacity), so this only keeps the list sensible.
 */
export function bookableMembers(members: readonly StaffMemberSummary[], classItem: Pick<StaffClassSummary, "roster">, query: string): StaffMemberSummary[] {
  const onRoster = new Set(classItem.roster.map((r) => r.userId));
  const q = query.trim().toLowerCase();
  const match = (m: StaffMemberSummary) =>
    !q || (m.fullName ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.phone ?? "").replace(/\s+/g, "").includes(q.replace(/\s+/g, ""));
  const rank = (m: StaffMemberSummary) => (m.membershipGroup === "current" ? 0 : m.membershipGroup === "paused" ? 1 : 2);
  const name = (m: StaffMemberSummary) => (m.fullName ?? m.email).toLowerCase();
  return members
    .filter((m) => !m.archivedAt && !onRoster.has(m.userId) && match(m))
    .sort((a, b) => rank(a) - rank(b) || name(a).localeCompare(name(b)));
}

export function bookOutcomeTitle(outcome: BookOutcome): string {
  return outcome === "waitlisted" ? "Added to the waitlist" : "Booked in";
}
