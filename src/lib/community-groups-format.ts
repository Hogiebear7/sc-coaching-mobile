import { formatCount } from "@/lib/community-formatters";
import type {
  CardioType,
  Challenge,
  ChallengeEntry,
  ChallengeMetric,
  ChallengeStatus,
  ChallengeUnit,
  CustomMeasure,
  NewCustomChallenge,
} from "@/lib/queries/community-groups";

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
/** The ready-made kinds (everything except "custom", which the setter defines). */
export type ReadyMetric = Exclude<ChallengeMetric, "custom">;

export const CHALLENGE_CATEGORIES: readonly { id: string; label: string; metrics: readonly ReadyMetric[] }[] = [
  { id: "strength", label: "Strength", metrics: ["volume", "squat", "bench", "deadlift"] },
  { id: "consistency", label: "Consistency", metrics: ["workouts", "training_time"] },
  { id: "running", label: "Running", metrics: ["run_distance", "run_longest", "run_time"] },
  { id: "cardio", label: "Cardio", metrics: ["cardio_time", "cardio_distance", "bike_distance", "row_distance"] },
];

export const CHALLENGE_METRICS: readonly ReadyMetric[] = CHALLENGE_CATEGORIES.flatMap((c) => c.metrics);

const METRIC_UNIT: Record<ReadyMetric, ChallengeUnit> = {
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

const METRIC_LABEL: Record<ReadyMetric, string> = {
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

const METRIC_HINT: Record<ReadyMetric, string> = {
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
  return metric === "custom" ? "Custom challenge" : (METRIC_LABEL[metric] ?? "Challenge");
}

export function challengeMetricHint(metric: ChallengeMetric): string {
  return metric === "custom" ? "" : (METRIC_HINT[metric] ?? "");
}

/** The category a metric sits in, for showing "Running · Longest run" style names. Custom has its own. */
export function challengeCategoryLabel(metric: ChallengeMetric): string | null {
  if (metric === "custom") return "Custom";
  return CHALLENGE_CATEGORIES.find((c) => (c.metrics as readonly ChallengeMetric[]).includes(metric))?.label ?? null;
}

/** What a challenge is called: the name the server gave it (always, for a custom one), otherwise worked out here. */
export function challengeDisplayLabel(c: Pick<Challenge, "metric" | "label">): string {
  return c.label ?? challengeMetricLabel(c.metric);
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

/** A time to beat as "20:58" or, past an hour, "1:05:30". */
export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/**
 * One score as a short label: "12,400 kg" for weights, "12.4 km" for distances, "1 h 15 min" for time, "20:58" for a time to beat, "12 reps", "9 days" for
 * days trained. `unit` is what the server says the number is (always sent for a custom challenge); without it the ready-made kind's own unit is used. A kind
 * this version doesn't know (a newer server) shows just the number rather than a wrong unit.
 */
export function formatChallengeValue(metric: ChallengeMetric, value: number, unit?: ChallengeUnit): string {
  switch (unit ?? (metric === "custom" ? undefined : METRIC_UNIT[metric])) {
    case "kg":
      return `${formatCount(value)} kg`;
    case "km":
      return `${plainNumber(value, 1)} km`;
    case "min":
      return formatMinutes(value);
    case "secs":
      return formatSeconds(value);
    case "reps":
      return `${plainNumber(value, 0)} ${value === 1 ? "rep" : "reps"}`;
    case "days":
      return `${plainNumber(value, 0)} ${value === 1 ? "day" : "days"}`;
    default:
      return plainNumber(value, 1);
  }
}

// ── Custom challenges ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The setter names an exercise (strength) or picks an activity (cardio) and chooses what to measure. The scoring unit follows from the measure, so it can't
// be mismatched. Mirrors the server's lib/challenges.ts, which is the authority and refuses anything else.

export interface CustomMeasureInfo {
  id: CustomMeasure;
  kind: "strength" | "cardio";
  label: string;
  unit: ChallengeUnit;
  /** How it is scored, in words, for the "Scored in" line. */
  scoring: string;
  hint: string;
}

export const CUSTOM_MEASURES: readonly CustomMeasureInfo[] = [
  { id: "best_weight", kind: "strength", label: "Best weight", unit: "kg", scoring: "Kilograms (kg). Heaviest wins.", hint: "The heaviest working set of the exercise." },
  { id: "total_volume", kind: "strength", label: "Total volume", unit: "kg", scoring: "Kilograms (kg). Highest wins.", hint: "Weight times reps, added up over every working set." },
  { id: "best_reps", kind: "strength", label: "Most reps in a set", unit: "reps", scoring: "Reps. Most wins.", hint: "The most reps in any one working set." },
  { id: "total_reps", kind: "strength", label: "Total reps", unit: "reps", scoring: "Reps. Most wins.", hint: "Every working-set rep, added up." },
  { id: "total_distance", kind: "cardio", label: "Total distance", unit: "km", scoring: "Kilometres (km). Furthest wins.", hint: "All the distance logged for the activity." },
  { id: "longest_distance", kind: "cardio", label: "Longest single go", unit: "km", scoring: "Kilometres (km). Furthest wins.", hint: "The longest single entry logged for the activity." },
  { id: "total_time", kind: "cardio", label: "Total time", unit: "min", scoring: "Time (hours and minutes). Longest wins.", hint: "All the time logged for the activity." },
  { id: "fastest_time", kind: "cardio", label: "Fastest time over a distance", unit: "secs", scoring: "Time (m:ss). Lowest time wins.", hint: "The quickest time over a distance you set, such as a 5 km run." },
];

export const CARDIO_TYPE_OPTIONS: readonly { id: CardioType; label: string }[] = [
  { id: "run", label: "Run" },
  { id: "walk", label: "Walk" },
  { id: "treadmill_walk", label: "Treadmill walk" },
  { id: "bike", label: "Bike" },
  { id: "rower", label: "Rower" },
  { id: "cross_trainer", label: "Cross trainer" },
  { id: "stair_climber", label: "Stair climber" },
  { id: "other", label: "Other cardio" },
];

export const MIN_CUSTOM_SUBJECT = 2;
export const MAX_CUSTOM_SUBJECT = 40;
export const MIN_TARGET_KM = 0.1;
export const MAX_TARGET_KM = 100;
/** A fastest-time entry counts from 1% under to 5% over the distance (so a GPS 4.98 km run counts for 5 km). Mirrors the server. */
export const TARGET_DISTANCE_UNDER = 0.99;
export const TARGET_DISTANCE_OVER = 1.05;

export const customMeasureInfo = (id: CustomMeasure): CustomMeasureInfo => CUSTOM_MEASURES.find((m) => m.id === id) ?? CUSTOM_MEASURES[0];
const cardioName = (id: CardioType) => CARDIO_TYPE_OPTIONS.find((c) => c.id === id)?.label ?? "Cardio";

/** Reads a distance a person typed: "5", "5.0", "5,5" (a comma works too). Null when it isn't a number. */
export function parseDistanceKm(text: string): number | null {
  const n = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export interface CustomForm {
  measure: CustomMeasure | null;
  /** Strength: the exercise typed. */
  exercise: string;
  /** Cardio: the activity picked. */
  cardioType: CardioType | null;
  /** fastest_time: the distance typed, in km. */
  distanceText: string;
}

/** Checks the custom form the way the server will, so the person sees what to fix before sending. Returns a sentence, or null when it is fine. */
export function validateCustomForm(form: CustomForm): string | null {
  if (!form.measure) return "Choose what to measure.";
  const info = customMeasureInfo(form.measure);
  if (info.kind === "strength") {
    const name = form.exercise.trim().replace(/\s+/g, " ");
    if (name.length < MIN_CUSTOM_SUBJECT || name.length > MAX_CUSTOM_SUBJECT || !/[A-Za-z]/.test(name)) {
      return `Name the exercise, ${MIN_CUSTOM_SUBJECT} to ${MAX_CUSTOM_SUBJECT} characters.`;
    }
    return null;
  }
  if (!form.cardioType) return "Choose the activity.";
  if (form.measure === "fastest_time") {
    const km = parseDistanceKm(form.distanceText);
    if (km === null || km < MIN_TARGET_KM || km > MAX_TARGET_KM) return `Enter the distance, between ${MIN_TARGET_KM} and ${MAX_TARGET_KM} km.`;
  }
  return null;
}

/** What to send for a valid form. Call validateCustomForm first. */
export function customPayload(form: CustomForm): NewCustomChallenge {
  const measure = form.measure as CustomMeasure;
  if (customMeasureInfo(measure).kind === "strength") return { measure, subject: form.exercise.trim().replace(/\s+/g, " ") };
  return {
    measure,
    cardioType: form.cardioType as CardioType,
    ...(measure === "fastest_time" ? { targetDistanceKm: parseDistanceKm(form.distanceText) ?? undefined } : {}),
  };
}

const kmWords = (n: number) => `${Number.isInteger(n) ? n : Math.round(n * 100) / 100} km`;

/** A name for the challenge made from the form: "Front squat: best weight", "5 km Run: fastest time". Used when the title is left blank. */
export function suggestedCustomTitle(form: CustomForm): string {
  if (!form.measure) return "";
  const info = customMeasureInfo(form.measure);
  let subject: string;
  if (info.kind === "strength") subject = form.exercise.trim().replace(/\s+/g, " ");
  else if (!form.cardioType) subject = "";
  else if (form.measure === "fastest_time") {
    const km = parseDistanceKm(form.distanceText);
    subject = km === null ? cardioName(form.cardioType) : `${kmWords(km)} ${cardioName(form.cardioType)}`;
  } else subject = cardioName(form.cardioType);
  if (!subject) return "";
  // The same short name the server gives it ("5 km Run: fastest time"), not the longer description on the chip.
  const text = `${subject}: ${form.measure === "fastest_time" ? "fastest time" : info.label.toLowerCase()}`;
  return text.length <= MAX_CHALLENGE_TITLE ? text : text.slice(0, MAX_CHALLENGE_TITLE);
}

/** One plain sentence on how the custom challenge will be scored, shown under the form so nothing is a surprise. */
export function customPreview(form: CustomForm): string {
  if (!form.measure) return "";
  const info = customMeasureInfo(form.measure);
  if (info.kind === "strength") {
    return `${info.hint} Counts any logged exercise whose name includes all the words you type. Warm-up sets don't count.`;
  }
  if (form.measure === "fastest_time") {
    const km = parseDistanceKm(form.distanceText);
    const window = km === null ? "" : ` Counts entries from ${plainNumber(km * TARGET_DISTANCE_UNDER, 2)} to ${plainNumber(km * TARGET_DISTANCE_OVER, 2)} km.`;
    return `${info.hint}${window}`;
  }
  return info.hint;
}

/** The description to show on a custom challenge's own screen. */
export function customChallengeHint(c: Challenge["custom"]): string {
  if (!c) return "";
  const info = customMeasureInfo(c.measure);
  if (info.kind === "strength") return `${info.hint} ${info.scoring}`;
  if (c.measure === "fastest_time" && c.targetDistanceKm) {
    const km = c.targetDistanceKm;
    return `${info.hint} Counts entries from ${plainNumber(km * TARGET_DISTANCE_UNDER, 2)} to ${plainNumber(km * TARGET_DISTANCE_OVER, 2)} km. ${info.scoring}`;
  }
  return `${info.hint} ${info.scoring}`;
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

/**
 * Standings as display rows, in the server's order (best first, which for a time to beat means the lowest), with the member's own row called "You". Pass the
 * challenge (so its unit is used, which a custom challenge needs) or just its kind.
 */
export function buildChallengeRows(entries: ChallengeEntry[], challenge: ChallengeMetric | Pick<Challenge, "metric" | "unit">, myUserId: string | null): ChallengeRow[] {
  const metric = typeof challenge === "string" ? challenge : challenge.metric;
  const unit = typeof challenge === "string" ? undefined : challenge.unit;
  return entries.map((e, i) => ({
    userId: e.userId,
    rank: i + 1,
    name: e.userId === myUserId ? "You" : e.displayName,
    isMe: e.userId === myUserId,
    valueLabel: formatChallengeValue(metric, e.value, unit),
  }));
}

/** Newest first: live challenges, then upcoming, then finished; canceled ones last. */
export function sortChallenges<T extends { status: ChallengeStatus; startDate: string }>(items: readonly T[]): T[] {
  const order: Record<ChallengeStatus, number> = { active: 0, upcoming: 1, ended: 2, canceled: 3 };
  return [...items].sort((a, b) => order[a.status] - order[b.status] || b.startDate.localeCompare(a.startDate));
}
