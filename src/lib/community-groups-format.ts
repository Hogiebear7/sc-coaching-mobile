import { formatCount } from "@/lib/community-formatters";
import type { ChallengeEntry, ChallengeMetric, ChallengeStatus } from "@/lib/queries/community-groups";

// Plain-text helpers for the Community groups / challenges / gym screens. Kept free of React so they can be tested directly.
// The limits mirror the server's (gym-app lib/challenges.ts and lib/community-groups.ts), which is the authority; they are repeated here only so a form
// can say what is allowed before the member submits.

export const MAX_GROUP_NAME = 60;
export const MAX_GROUP_DESCRIPTION = 300;
export const MAX_CHALLENGE_TITLE = 60;
export const MAX_CHALLENGE_DAYS = 90;
export const MAX_START_AHEAD_DAYS = 60;
export const MAX_GYM_POST = 1000;
export const MAX_GYM_COMMENT = 500;
export const MAX_GYM_REPORT_REASON = 200;
export const MAX_GROUPS_PER_ORGANISER = 5;
export const MAX_MEMBERS_PER_GROUP = 50;

// What a challenge can be scored on, in the groups the screens show them in. Mirrors CHALLENGE_CATEGORIES in the server's lib/challenges.ts (the server is the
// authority and refuses anything else): Strength and the leaderboard's lifts, Consistency, Running, and Cardio of any type.
export const CHALLENGE_CATEGORIES: readonly { id: string; label: string; metrics: readonly ChallengeMetric[] }[] = [
  { id: "strength", label: "Strength", metrics: ["volume", "squat", "bench", "deadlift"] },
  { id: "consistency", label: "Consistency", metrics: ["workouts", "training_time"] },
  { id: "running", label: "Running", metrics: ["run_distance", "run_longest", "run_time"] },
  { id: "cardio", label: "Cardio", metrics: ["cardio_time", "cardio_distance", "bike_distance", "row_distance"] },
];

export const CHALLENGE_METRICS: readonly ChallengeMetric[] = CHALLENGE_CATEGORIES.flatMap((c) => c.metrics);

type MetricUnit = "kg" | "km" | "min" | "days";
const METRIC_UNIT: Record<ChallengeMetric, MetricUnit> = {
  volume: "kg",
  squat: "kg",
  bench: "kg",
  deadlift: "kg",
  workouts: "days",
  training_time: "min",
  run_distance: "km",
  run_longest: "km",
  run_time: "min",
  cardio_time: "min",
  cardio_distance: "km",
  bike_distance: "km",
  row_distance: "km",
};

const METRIC_LABEL: Record<ChallengeMetric, string> = {
  volume: "Total volume",
  squat: "Best squat",
  bench: "Best bench",
  deadlift: "Best deadlift",
  workouts: "Days trained",
  training_time: "Training time",
  run_distance: "Running distance",
  run_longest: "Longest run",
  run_time: "Running time",
  cardio_time: "Cardio time",
  cardio_distance: "Cardio distance",
  bike_distance: "Cycling distance",
  row_distance: "Rowing distance",
};

const METRIC_HINT: Record<ChallengeMetric, string> = {
  volume: "Weight lifted across every logged workout in the dates.",
  squat: "Heaviest squat logged in the dates.",
  bench: "Heaviest bench press logged in the dates.",
  deadlift: "Heaviest deadlift logged in the dates.",
  workouts: "How many different days someone trains.",
  training_time: "Total time of the workouts they log, from the duration on each session.",
  run_distance: "Total distance of logged runs. Walks, rides and machines don't count.",
  run_longest: "The longest single run logged in the dates.",
  run_time: "Total time of logged runs.",
  cardio_time: "Total time of all cardio logged: runs, walks, rides, rowing and machines.",
  cardio_distance: "Total distance of all cardio logged, whatever the type.",
  bike_distance: "Total distance of logged bike rides.",
  row_distance: "Total distance of logged rowing machine work.",
};

export function challengeMetricLabel(metric: ChallengeMetric): string {
  return METRIC_LABEL[metric] ?? "Challenge";
}

export function challengeMetricHint(metric: ChallengeMetric): string {
  return METRIC_HINT[metric] ?? "";
}

/** The category a metric sits in, for showing "Running · Longest run" style names. */
export function challengeCategoryLabel(metric: ChallengeMetric): string | null {
  return CHALLENGE_CATEGORIES.find((c) => c.metrics.includes(metric))?.label ?? null;
}

/** A number with up to `max` decimals and no trailing zero: 12.4, 10, 1,250. */
function plainNumber(value: number, max = 1): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IE", { maximumFractionDigits: max });
}

/** Minutes as "45 min", "1 h 15 min" or "2 h". */
export function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * One score as a short label: "12,400 kg" for weights, "12.4 km" for distances, "1 h 15 min" for time, "9 days" for days trained. A metric this version doesn't
 * know (a newer server) shows just the number rather than a wrong unit.
 */
export function formatChallengeValue(metric: ChallengeMetric, value: number): string {
  switch (METRIC_UNIT[metric]) {
    case "kg":
      return `${formatCount(value)} kg`;
    case "km":
      return `${plainNumber(value, 1)} km`;
    case "min":
      return formatMinutes(value);
    case "days":
      return `${plainNumber(value, 0)} ${value === 1 ? "day" : "days"}`;
    default:
      return plainNumber(value, 1);
  }
}

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  upcoming: "Starts soon",
  active: "Live now",
  ended: "Finished",
  canceled: "Canceled",
};

export function challengeStatusLabel(status: ChallengeStatus): string {
  return STATUS_LABEL[status] ?? status;
}

/** "3 Nov to 30 Nov", or "3 to 30 Nov" inside one month, with the year added when it is not this year. */
export function formatChallengeDates(startISO: string, endISO: string, now: Date = new Date()): string {
  const start = parseIso(startISO);
  const end = parseIso(endISO);
  if (!start || !end) return `${startISO} to ${endISO}`;
  const month = (d: Date) => d.toLocaleDateString("en-IE", { month: "short", timeZone: "UTC" });
  const withYear = (d: Date) => (d.getUTCFullYear() === now.getUTCFullYear() ? "" : ` ${d.getUTCFullYear()}`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (startISO === endISO) return `${end.getUTCDate()} ${month(end)}${withYear(end)}`;
  if (sameMonth) return `${start.getUTCDate()} to ${end.getUTCDate()} ${month(end)}${withYear(end)}`;
  return `${start.getUTCDate()} ${month(start)}${withYear(start)} to ${end.getUTCDate()} ${month(end)}${withYear(end)}`;
}

function parseIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days from one YYYY-MM-DD to another (end minus start). */
export function daysBetweenIso(startISO: string, endISO: string): number {
  const a = parseIso(startISO);
  const b = parseIso(endISO);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Checks a new challenge form the same way the server will, so the member sees the reason before sending. Returns an error sentence, or null when it is fine.
 * `today` is YYYY-MM-DD.
 */
export function validateChallengeForm(
  input: { title: string; startDate: string; endDate: string },
  today: string
): string | null {
  const title = input.title.trim();
  if (!title) return "Give the challenge a title.";
  if (title.length > MAX_CHALLENGE_TITLE) return `The title can be up to ${MAX_CHALLENGE_TITLE} characters.`;
  if (!parseIso(input.startDate) || !parseIso(input.endDate)) return "Choose a start and end date.";
  if (input.startDate < today) return "A challenge can't start in the past.";
  if (daysBetweenIso(today, input.startDate) > MAX_START_AHEAD_DAYS) return `A challenge can start up to ${MAX_START_AHEAD_DAYS} days from now.`;
  if (input.endDate < input.startDate) return "The end date can't be before the start date.";
  if (daysBetweenIso(input.startDate, input.endDate) + 1 > MAX_CHALLENGE_DAYS) return `A challenge can run for up to ${MAX_CHALLENGE_DAYS} days.`;
  return null;
}

/** Shows an invite code as XXXX-XXXX so it is easy to read out and type. */
export function formatInviteCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** What a person typed or pasted, reduced to the stored form (the server does the same). */
export function normaliseInviteCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Pulls a code out of a pasted invite message or link, e.g. "Join my group! Code: ABCD-2345" or ".../join?code=ABCD2345". */
export function extractInviteCode(text: string): string {
  const labelled = text.match(/code\s*[:=]?\s*([A-Za-z0-9-]{8,12})/i);
  if (labelled) return normaliseInviteCode(labelled[1]);
  return normaliseInviteCode(text);
}

/** The text a member shares to invite someone. Only the organiser has the code. */
export function groupInviteMessage(groupName: string, inviteCode: string): string {
  return `Join my group "${groupName}" on the S&C Performance Coaching app. In Community, open Groups, tap Join with a code, and enter ${formatInviteCode(inviteCode)}.`;
}

export interface ChallengeRow {
  userId: string;
  rank: number;
  name: string;
  isMe: boolean;
  valueLabel: string;
}

/** Standings as display rows, in the server's order (best first), with the member's own row called "You". */
export function buildChallengeRows(entries: ChallengeEntry[], metric: ChallengeMetric, myUserId: string | null): ChallengeRow[] {
  return entries.map((e, i) => ({
    userId: e.userId,
    rank: i + 1,
    name: e.userId === myUserId ? "You" : e.displayName,
    isMe: e.userId === myUserId,
    valueLabel: formatChallengeValue(metric, e.value),
  }));
}

/** Newest first: live challenges, then upcoming, then finished; canceled ones last. */
export function sortChallenges<T extends { status: ChallengeStatus; startDate: string }>(items: readonly T[]): T[] {
  const order: Record<ChallengeStatus, number> = { active: 0, upcoming: 1, ended: 2, canceled: 3 };
  return [...items].sort((a, b) => order[a.status] - order[b.status] || b.startDate.localeCompare(a.startDate));
}
