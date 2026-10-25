// When to suggest "Match my training" to a member on even calories
// (nutrition targets v2): they've logged at least 3 workouts in each of the
// last 3 full Mon-Sun weeks, their split is even, and a coach hasn't locked
// it. Pure, so it's unit-tested; the card stores its own dismissal.

const MIN_SESSIONS_PER_WEEK = 3;
const WEEKS = 3;

function isoDaysFrom(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateISO: string): string {
  const day = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return isoDaysFrom(dateISO, day === 0 ? -6 : 1 - day);
}

export function shouldSuggestTrainingSplit(input: {
  sessionDates: string[];
  today: string;
  distribution: "even" | "training" | null | undefined;
  locked: boolean;
}): boolean {
  if (input.distribution !== "even" || input.locked) return false;
  const thisMonday = mondayOf(input.today);
  for (let w = 1; w <= WEEKS; w++) {
    const start = isoDaysFrom(thisMonday, -7 * w);
    const end = isoDaysFrom(start, 6);
    const count = input.sessionDates.filter((d) => d >= start && d <= end).length;
    if (count < MIN_SESSIONS_PER_WEEK) return false;
  }
  return true;
}
