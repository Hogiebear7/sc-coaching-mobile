// Display maths for the pregnancy guide (pure: no React Native, no API). The server decides who is pregnant and the trimester
// (lib/pregnancy.ts in the main repo: weeks < 14 is the first trimester, < 28 the second, the rest the third). This file only turns
// the due date it returns into the numbers the screens show: day, week, progress and days to go.
// A due date is 40 weeks (280 days) from the start of the pregnancy.

export const PREGNANCY_TOTAL_DAYS = 280;
export const PREGNANCY_TOTAL_WEEKS = 40;

// Where the trimesters fall on a 40-week bar, as fractions of its width (weeks 0-13, 14-27, 28-40).
export const TRIMESTER_SEGMENTS = [14 / 40, 14 / 40, 12 / 40] as const;

const DAY_MS = 86_400_000;

function dayNumber(dateISO: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : Math.floor(ms / DAY_MS);
}

/** Whole days between two YYYY-MM-DD dates (to minus from), or null if either does not parse. */
export function daysBetween(fromISO: string, toISO: string): number | null {
  const a = dayNumber(fromISO);
  const b = dayNumber(toISO);
  return a === null || b === null ? null : b - a;
}

export interface PregnancyDay {
  /** Day of the pregnancy, 0 on the first day, clamped to 0..280. */
  day: number;
  /** Completed weeks, 0..40. */
  weeks: number;
  /** Days into the current week, 0..6. */
  days: number;
  /** Whole days until the due date, never negative. */
  daysToGo: number;
  /** 0..1 across the whole 40 weeks. */
  progress: number;
}

/** Where today falls in the pregnancy, from the due date. Null when the due date is missing or unreadable. */
export function pregnancyDay(dueDateISO: string | null, todayISO: string): PregnancyDay | null {
  if (!dueDateISO) return null;
  const toDue = daysBetween(todayISO, dueDateISO);
  if (toDue === null) return null;
  const day = Math.min(PREGNANCY_TOTAL_DAYS, Math.max(0, PREGNANCY_TOTAL_DAYS - toDue));
  return {
    day,
    weeks: Math.floor(day / 7),
    days: day % 7,
    daysToGo: Math.max(0, toDue),
    progress: day / PREGNANCY_TOTAL_DAYS,
  };
}

/** "Week 24 · day 3" (the week in progress is the completed weeks plus one, as people count it: day 0 is the start of week 1). */
export function weekDayLabel(p: PregnancyDay): string {
  return `Week ${Math.min(PREGNANCY_TOTAL_WEEKS, p.weeks + 1)} · day ${p.days + 1}`;
}

/** "12 weeks to go", "6 days to go", "Due today". */
export function toGoLabel(p: PregnancyDay): string {
  if (p.daysToGo === 0) return "Due today";
  if (p.daysToGo < 14) return `${p.daysToGo} ${p.daysToGo === 1 ? "day" : "days"} to go`;
  const w = Math.round(p.daysToGo / 7);
  return `${w} weeks to go`;
}

/** Weeks since the birth, for the postpartum view: "3 weeks since the birth", "Newly arrived" within the first week. */
export function sinceBirthLabel(birthDateISO: string | null, todayISO: string): string | null {
  if (!birthDateISO) return null;
  const d = daysBetween(birthDateISO, todayISO);
  if (d === null || d < 0) return null;
  if (d < 7) return "Newly arrived";
  const w = Math.floor(d / 7);
  return `${w} ${w === 1 ? "week" : "weeks"} since the birth`;
}

/** "12 Mar 2027" for the due date; the raw string if it does not parse. */
export function formatDueDate(dueDateISO: string | null): string | null {
  if (!dueDateISO) return null;
  const n = dayNumber(dueDateISO);
  if (n === null) return dueDateISO;
  const d = new Date(n * DAY_MS);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
