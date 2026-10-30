// What the home-screen widgets show (owner request 2026-10-30): water, nutrition and the next class. The app builds one snapshot from data it
// has already loaded and hands it to the widgets; a widget never signs in or calls the server itself. Plain TypeScript, no React Native, so
// the same builder feeds the native widgets and the in-app previews (src/components/widgets), and is unit-tested.

export interface WaterWidgetData {
  /** YYYY-MM-DD on the phone. A widget showing another day's numbers shows 0 instead. */
  date: string;
  loggedMl: number;
  targetMl: number | null;
  /** The member's usual amount (Settings > Water amount): what the widget's "+" button adds. */
  amountMl: number;
}

export interface NutritionWidgetData {
  date: string;
  calories: number;
  /** Null on the Free plan (no daily targets) or when no target can be worked out yet. */
  targetCalories: number | null;
  proteinG: number;
  targetProteinG: number | null;
}

export interface ClassWidgetData {
  next: { title: string; date: string; startTime: string } | null;
  /** Classes left this period on a class-pack plan (Over 50s, Parent & Baby). Null for unlimited plans or no plan. */
  classesLeft: number | null;
  /** Whether the member can book at all (a gym Membership). */
  canBook: boolean;
}

export interface WidgetSnapshot {
  updatedAt: string;
  water: WaterWidgetData | null;
  nutrition: NutritionWidgetData | null;
  classes: ClassWidgetData | null;
}

export function buildWaterData(date: string, hydration: { loggedMl: number; targetMl: number | null } | undefined, amountMl: number): WaterWidgetData | null {
  if (!hydration) return null;
  return { date, loggedMl: Math.max(0, Math.round(hydration.loggedMl)), targetMl: hydration.targetMl, amountMl };
}

export function buildNutritionData(
  date: string,
  totals: { calories: number; proteinG: number } | undefined,
  target: { calories: number | null; proteinG: number | null } | null | undefined
): NutritionWidgetData | null {
  if (!totals) return null;
  return {
    date,
    calories: Math.round(totals.calories),
    targetCalories: target?.calories ?? null,
    proteinG: Math.round(totals.proteinG),
    targetProteinG: target?.proteinG ?? null,
  };
}

export function buildClassData(
  schedule:
    | { remainingSessions: number | null; noActiveMembership: boolean; upcomingBookings: { title: string; date: string; startTime: string }[] }
    | undefined,
  now: Date = new Date()
): ClassWidgetData | null {
  if (!schedule) return null;
  const nowKey = `${localDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const next =
    [...schedule.upcomingBookings]
      .filter((b) => `${b.date} ${b.startTime}` >= nowKey)
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0] ?? null;
  return {
    next: next ? { title: next.title, date: next.date, startTime: next.startTime } : null,
    classesLeft: schedule.noActiveMembership ? null : schedule.remainingSessions,
    canBook: !schedule.noActiveMembership,
  };
}

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today 18:30", "Tomorrow 07:00", or "Wed 5 Nov, 09:15". */
export function describeClassTime(date: string, startTime: string, now: Date = new Date()): string {
  const today = localDate(now);
  const tomorrow = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (date === today) return `Today ${startTime}`;
  if (date === tomorrow) return `Tomorrow ${startTime}`;
  const d = new Date(`${date}T00:00:00`);
  return `${d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}, ${startTime}`;
}

/** 0 to 1, for a ring or bar. 0 when there is no target. */
export function progress(value: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

/** "1.2 L" from ml, one decimal. */
export const litres = (ml: number) => `${(ml / 1000).toFixed(1)} L`;

// ── Water added from the widget ─────────────────────────────────────────────────────────────────────────────────────
// An iPhone widget button can't reach the server, so the widget keeps a running total of what its button added today (widgetAddedMl) and
// the app sends the difference when it next runs. The app remembers how much of that day's total it has already sent (syncedMl), so sending
// is idempotent: opening the app twice, or a send that succeeded but wasn't recorded, never adds the same water twice.

export interface WidgetWaterTaps {
  date: string;
  widgetAddedMl: number;
}

/** How much water to send now, given what the widget added and what was already sent for that day. Never negative. */
export function waterToSync(taps: WidgetWaterTaps | null, synced: { date: string; syncedMl: number } | null): { date: string; deltaMl: number } | null {
  if (!taps || taps.widgetAddedMl <= 0) return null;
  const already = synced && synced.date === taps.date ? synced.syncedMl : 0;
  const deltaMl = taps.widgetAddedMl - already;
  return deltaMl > 0 ? { date: taps.date, deltaMl } : null;
}
