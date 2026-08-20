import type { WorkoutExerciseEntry, WorkoutRunEntry, WorkoutSessionSummary, WorkoutSetType } from "@/lib/queries/workouts";

export const SET_TYPE_LABEL: Record<WorkoutSetType, string> = {
  standard: "",
  warmup: "warm-up",
  dropset: "dropset",
  myoset: "myoset",
  failure: "failure",
  partial: "partials",
};

// Ported 1:1 from the main repo's app/(dashboard)/dashboard/workouts/
// shared/formatters.ts and lib/workout-entries.ts — pure functions, no
// behavior changes, just moved to run on-device instead of server-side.

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Parses "MM:SS" or "H:MM:SS" → total seconds, or a bare number as minutes.
export function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) {
    const [m, sec] = parts;
    if (sec >= 60) return null;
    return m * 60 + sec;
  }
  if (parts.length === 3) {
    const [h, m, sec] = parts;
    if (m >= 60 || sec >= 60) return null;
    return h * 3600 + m * 60 + sec;
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : null;
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function livePace(distanceRaw: string, distanceUnit: "km" | "m", durationRaw: string): string | null {
  const rawDistance = parseFloat(distanceRaw);
  if (!Number.isFinite(rawDistance) || rawDistance <= 0) return null;
  const km = distanceUnit === "m" ? rawDistance / 1000 : rawDistance;

  const secs = parseDuration(durationRaw);
  if (secs === null || secs <= 0) return null;

  const paceSecs = Math.round(secs / km);
  return `${Math.floor(paceSecs / 60)}:${String(paceSecs % 60).padStart(2, "0")} /km`;
}

export function formatAsKg(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed} kg` : trimmed;
}

export function formatAsMmSs(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes(":")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (digits.length <= 2) return `0:${digits.padStart(2, "0")}`;
  return `${Number(digits.slice(0, -2))}:${digits.slice(-2)}`;
}

export function formatRun(run: WorkoutRunEntry): string {
  const parts: string[] = [];
  if (run.distance !== null) parts.push(`${run.distance} ${run.distanceUnit}`);
  if (run.durationSecs !== null) parts.push(formatDuration(run.durationSecs));
  if (run.distance !== null && run.distance > 0 && run.durationSecs !== null && run.durationSecs > 0) {
    const paceSecs = Math.round(run.durationSecs / run.distance);
    parts.push(`${Math.floor(paceSecs / 60)}:${String(paceSecs % 60).padStart(2, "0")} /km`);
  }
  if (run.sets !== null && run.reps !== null) parts.push(`${run.sets}×${run.reps}`);
  else if (run.sets !== null) parts.push(`${run.sets} sets`);
  else if (run.reps !== null) parts.push(`${run.reps} reps`);
  return parts.join(" · ");
}

// Compact display for an exercise entry: per-set detail when present,
// otherwise the shared sets×reps @ weight form.
export function formatExerciseLoad(ex: WorkoutExerciseEntry): string {
  const perSideSuffix = ex.perSide ? "/side" : "";
  if (ex.setDetails && ex.setDetails.length > 0) {
    return ex.setDetails
      .map((s) => {
        const repsLabel =
          s.repsRight !== null && s.repsRight !== undefined && s.repsLeft !== null && s.repsLeft !== undefined
            ? `R${s.repsRight}/L${s.repsLeft}`
            : s.reps !== null
              ? `×${s.reps}${perSideSuffix}`
              : null;
        const load = s.weight && repsLabel
          ? `${s.weight}${repsLabel.startsWith("R") ? " " : ""}${repsLabel}`
          : s.weight
            ? s.weight
            : (repsLabel ?? "—");
        const typeLabel = s.setType ? SET_TYPE_LABEL[s.setType] : "";
        return typeLabel ? `${load} (${typeLabel})` : load;
      })
      .join(", ");
  }
  const parts: string[] = [];
  if (ex.sets !== null && ex.reps !== null) parts.push(`${ex.sets}×${ex.reps}${perSideSuffix}`);
  else if (ex.sets !== null) parts.push(`${ex.sets} sets`);
  else if (ex.reps !== null) parts.push(`${ex.reps} reps${perSideSuffix}`);
  if (ex.weight) parts.push(`@ ${ex.weight}`);
  if (ex.rir != null) parts.push(`RIR ${ex.rir}`);
  if (ex.setType && SET_TYPE_LABEL[ex.setType]) parts.push(`(${SET_TYPE_LABEL[ex.setType]})`);
  return parts.join(" ");
}

export interface ExerciseTrendPoint {
  date: string;
  weightNum: number | null;
  rawWeight: string | null;
  reps: number | null;
}

// Ported from lib/workouts.ts's getExerciseTrend — oldest-first, one point
// per date (keeps the best entry when an exercise appears more than once on
// the same day).
export function getExerciseTrend(
  sessions: { date: string; exercises: WorkoutExerciseEntry[] }[],
  exerciseName: string
): ExerciseTrendPoint[] {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) return [];

  const byDate = new Map<string, ExerciseTrendPoint>();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (ex.name.trim().toLowerCase() !== normalized) continue;

      const weightNum = ex.weight ? parseFloat(ex.weight) : NaN;
      const numericWeight = Number.isFinite(weightNum) ? weightNum : null;

      const existing = byDate.get(session.date);

      if (!existing) {
        byDate.set(session.date, { date: session.date, weightNum: numericWeight, rawWeight: ex.weight, reps: ex.reps });
        continue;
      }

      const betterWeight = numericWeight !== null && (existing.weightNum === null || numericWeight > existing.weightNum);
      const betterReps =
        numericWeight === null &&
        existing.weightNum === null &&
        ex.reps !== null &&
        (existing.reps === null || ex.reps > existing.reps);

      if (betterWeight || betterReps) {
        byDate.set(session.date, { date: session.date, weightNum: numericWeight, rawWeight: ex.weight, reps: ex.reps });
      }
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface LastPerformance {
  date: string;
  summary: string;
  entry: WorkoutExerciseEntry;
}

// Most recent logged entry for an exercise, formatted for an inline "last
// time" hint while filling in a new entry. Exact-name-matched, same as
// getExerciseTrend; returns null if the exercise has never been logged.
export function getLastExercisePerformance(
  sessions: { date: string; exercises: WorkoutExerciseEntry[] }[],
  exerciseName: string
): LastPerformance | null {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) return null;

  let best: { date: string; entry: WorkoutExerciseEntry } | null = null;
  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (ex.name.trim().toLowerCase() !== normalized) continue;
      if (!best || session.date > best.date) best = { date: session.date, entry: ex };
    }
  }
  if (!best) return null;
  return { date: best.date, summary: formatExerciseLoad(best.entry), entry: best.entry };
}

// The specific set (by index) from a last-performance entry, for a per-row
// ghost hint. Falls back to the entry's shared weight/reps for index 0 when
// no per-set breakdown was recorded.
export function getLastSetForIndex(last: LastPerformance | null, index: number): { weight: string | null; reps: number | null } | null {
  if (!last) return null;
  const fromDetails = last.entry.setDetails?.[index];
  if (fromDetails) return { weight: fromDetails.weight, reps: fromDetails.reps };
  if (index === 0 && (last.entry.weight !== null || last.entry.reps !== null)) {
    return { weight: last.entry.weight, reps: last.entry.reps };
  }
  return null;
}

// Every logged exercise entry reduces to a flat array of individual sets —
// setDetails when present, otherwise one synthetic set per the shared
// weight/reps/sets fields (same fallback the backend's weeklyWorkoutStats
// and computePersonalBests use, kept consistent here).
function synthesizeSets(ex: WorkoutExerciseEntry): { weight: string | null; reps: number | null }[] {
  return ex.setDetails && ex.setDetails.length > 0
    ? ex.setDetails
    : Array.from({ length: ex.sets ?? 1 }, () => ({ weight: ex.weight, reps: ex.reps }));
}

export function computeExerciseSetTotals(ex: WorkoutExerciseEntry): { sets: number; volume: number } {
  const sets = synthesizeSets(ex);
  let volume = 0;
  for (const s of sets) {
    const w = s.weight ? parseFloat(s.weight) : NaN;
    if (Number.isFinite(w) && s.reps !== null) volume += w * s.reps;
  }
  return { sets: sets.length, volume };
}

export function computeSessionTotals(exercises: WorkoutExerciseEntry[]): { totalSets: number; totalVolume: number } {
  let totalSets = 0;
  let totalVolume = 0;
  for (const ex of exercises) {
    const t = computeExerciseSetTotals(ex);
    totalSets += t.sets;
    totalVolume += t.volume;
  }
  return { totalSets, totalVolume: Math.round(totalVolume) };
}

function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export interface WeeklyStats {
  workoutCount: number;
  totalSets: number;
  totalVolume: number;
}

// Ported from the main repo's lib/workouts.ts weeklyWorkoutStats (same
// Monday-boundary math and Σ sets×reps×weight logic), extended with a set
// count the backend version doesn't track.
export function computeWeeklyStats(sessions: { date: string; exercises: WorkoutExerciseEntry[] }[], todayISO: string): WeeklyStats {
  const mondayISO = mondayOf(todayISO);
  let workoutCount = 0;
  let totalSets = 0;
  let totalVolume = 0;

  for (const session of sessions) {
    if (session.date < mondayISO || session.date > todayISO) continue;
    workoutCount += 1;
    const t = computeSessionTotals(session.exercises);
    totalSets += t.totalSets;
    totalVolume += t.totalVolume;
  }
  return { workoutCount, totalSets, totalVolume: Math.round(totalVolume) };
}

// MacroFactor-style trend date-range chips — days: null means All (no
// filter). Shared by the dashboard's Progression chart and the exercise
// detail screen so both filter identically.
export const TREND_RANGES: { key: string; days: number | null }[] = [
  { key: "1W", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
  { key: "All", days: null },
];

function cutoffDateString(daysBack: number, todayISO: string): string {
  const [y, m, d] = todayISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - (daysBack - 1))).toISOString().slice(0, 10);
}

export function filterPointsByRange<T extends { date: string }>(points: T[], rangeKey: string, todayISO: string): T[] {
  const range = TREND_RANGES.find((r) => r.key === rangeKey);
  if (!range || range.days === null) return points;
  const cutoff = cutoffDateString(range.days, todayISO);
  return points.filter((p) => p.date >= cutoff);
}

export interface ExerciseHistoryEntry {
  date: string;
  summary: string;
  sessionId: string;
}

export interface ExerciseStats {
  sessionCount: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  heaviestWeight: { value: number; weightStr: string; date: string; reps: number | null } | null;
  bestSetReps: { reps: number; date: string } | null;
  bestSetVolume: { value: number; date: string } | null;
  estimatedOneRepMax: { value: number; date: string } | null;
  history: ExerciseHistoryEntry[];
}

// The full stat line for one exercise across every logged session —
// heaviest set, best single-set volume/reps, a rough Epley 1RM estimate,
// running totals, and a session-by-session history for a detail screen.
// Exact-name-matched, same convention as getExerciseTrend/getLastExercisePerformance.
export function getExerciseStats(sessions: WorkoutSessionSummary[], exerciseName: string): ExerciseStats {
  const normalized = exerciseName.trim().toLowerCase();
  const stats: ExerciseStats = {
    sessionCount: 0,
    totalSets: 0,
    totalReps: 0,
    totalVolume: 0,
    heaviestWeight: null,
    bestSetReps: null,
    bestSetVolume: null,
    estimatedOneRepMax: null,
    history: [],
  };
  if (!normalized) return stats;

  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.name.trim().toLowerCase() === normalized);
    if (!ex) continue;

    stats.sessionCount += 1;
    stats.history.push({ date: session.date, summary: formatExerciseLoad(ex), sessionId: session.id });

    for (const set of synthesizeSets(ex)) {
      stats.totalSets += 1;
      if (set.reps !== null) stats.totalReps += set.reps;

      const w = set.weight ? parseFloat(set.weight) : NaN;
      if (!Number.isFinite(w)) continue;

      if (!stats.heaviestWeight || w > stats.heaviestWeight.value) {
        stats.heaviestWeight = { value: w, weightStr: set.weight as string, date: session.date, reps: set.reps };
      }
      if (set.reps === null) continue;

      const volume = w * set.reps;
      stats.totalVolume += volume;
      if (!stats.bestSetVolume || volume > stats.bestSetVolume.value) {
        stats.bestSetVolume = { value: Math.round(volume), date: session.date };
      }
      if (!stats.bestSetReps || set.reps > stats.bestSetReps.reps) {
        stats.bestSetReps = { reps: set.reps, date: session.date };
      }
      const oneRm = w * (1 + set.reps / 30);
      if (!stats.estimatedOneRepMax || oneRm > stats.estimatedOneRepMax.value) {
        stats.estimatedOneRepMax = { value: Math.round(oneRm * 10) / 10, date: session.date };
      }
    }
  }

  stats.totalVolume = Math.round(stats.totalVolume);
  return stats;
}

// Generic chartable point — every trend series (weight/reps, a specific
// exercise metric, or a weekly sets/volume aggregate) reduces to this shape
// so TrendChart itself stays metric-agnostic.
export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

// Maps the legacy weight-or-reps series (getExerciseTrend) to the generic
// point shape, preserving the exact "plot weight if any point has one, else
// plot reps" fallback TrendChart used to do internally.
export function exerciseTrendToPoints(points: ExerciseTrendPoint[]): { points: TrendPoint[]; metricLabel: string } {
  const useWeight = points.some((p) => p.weightNum !== null);
  const filtered = useWeight ? points.filter((p) => p.weightNum !== null) : points.filter((p) => p.reps !== null);
  return {
    points: filtered.map((p) => ({
      date: p.date,
      value: useWeight ? (p.weightNum as number) : (p.reps as number),
      label: useWeight ? p.rawWeight ?? String(p.weightNum) : String(p.reps),
    })),
    metricLabel: useWeight ? "kg" : "reps",
  };
}

// One exercise entry's session-level metrics — every "switchable metric" on
// exercise detail reduces to a field here, computed once per session.
function exerciseSessionMetrics(ex: WorkoutExerciseEntry): {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  heaviestWeight: number | null;
  bestSetVolume: number | null;
  estimatedOneRepMax: number | null;
} {
  let totalReps = 0;
  let totalVolume = 0;
  let heaviestWeight: number | null = null;
  let bestSetVolume: number | null = null;
  let estimatedOneRepMax: number | null = null;

  const sets = synthesizeSets(ex);
  for (const s of sets) {
    if (s.reps !== null) totalReps += s.reps;

    const w = s.weight ? parseFloat(s.weight) : NaN;
    if (!Number.isFinite(w)) continue;
    if (heaviestWeight === null || w > heaviestWeight) heaviestWeight = w;
    if (s.reps === null) continue;

    const volume = w * s.reps;
    totalVolume += volume;
    if (bestSetVolume === null || volume > bestSetVolume) bestSetVolume = volume;

    const oneRm = w * (1 + s.reps / 30);
    if (estimatedOneRepMax === null || oneRm > estimatedOneRepMax) estimatedOneRepMax = oneRm;
  }

  return {
    totalSets: sets.length,
    totalReps,
    totalVolume: Math.round(totalVolume),
    heaviestWeight,
    bestSetVolume: bestSetVolume !== null ? Math.round(bestSetVolume) : null,
    estimatedOneRepMax: estimatedOneRepMax !== null ? Math.round(estimatedOneRepMax * 10) / 10 : null,
  };
}

export type ExerciseMetricKey = "estimatedOneRepMax" | "heaviestWeight" | "totalVolume" | "bestSetVolume" | "totalReps" | "totalSets";

export const EXERCISE_METRICS: { key: ExerciseMetricKey; label: string; unit: string }[] = [
  { key: "estimatedOneRepMax", label: "Est. 1RM", unit: "kg" },
  { key: "heaviestWeight", label: "Heaviest", unit: "kg" },
  { key: "totalVolume", label: "Volume", unit: "kg" },
  { key: "bestSetVolume", label: "Best Set Vol.", unit: "kg" },
  { key: "totalReps", label: "Reps", unit: "reps" },
  { key: "totalSets", label: "Sets", unit: "sets" },
];

// Per-session trend for one exercise metric — the data source behind
// exercise detail's metric-switcher chart. One point per date (best value
// wins on same-day duplicates), oldest-first, same convention as
// getExerciseTrend.
export function getExerciseMetricTrend(sessions: WorkoutSessionSummary[], exerciseName: string, metric: ExerciseMetricKey): TrendPoint[] {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) return [];

  const byDate = new Map<string, TrendPoint>();
  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.name.trim().toLowerCase() === normalized);
    if (!ex) continue;

    const value = exerciseSessionMetrics(ex)[metric];
    if (value === null) continue;

    const existing = byDate.get(session.date);
    if (!existing || value > existing.value) {
      byDate.set(session.date, { date: session.date, value, label: String(value) });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface WeeklyTrendPoint {
  date: string; // Monday of the week
  workoutCount: number;
  totalSets: number;
  totalVolume: number;
}

// Every logged session bucketed into its Monday-start week — the data
// source for the Training Trends screen's sets/volume-over-time charts.
// Oldest-first.
export function getWeeklyTrend(sessions: WorkoutSessionSummary[]): WeeklyTrendPoint[] {
  const byWeek = new Map<string, WeeklyTrendPoint>();
  for (const session of sessions) {
    const weekStart = mondayOf(session.date);
    const totals = computeSessionTotals(session.exercises);
    const existing = byWeek.get(weekStart) ?? { date: weekStart, workoutCount: 0, totalSets: 0, totalVolume: 0 };
    existing.workoutCount += 1;
    existing.totalSets += totals.totalSets;
    existing.totalVolume += totals.totalVolume;
    byWeek.set(weekStart, existing);
  }
  return [...byWeek.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExerciseContribution {
  name: string;
  sets: number;
  volume: number;
}

// Per-exercise sets/volume contributed within a date range — the data
// source for the Training Trends screen's "top exercises" list. Caller
// sorts by whichever of .sets/.volume matches the metric currently shown.
export function getExerciseContributions(sessions: WorkoutSessionSummary[], rangeKey: string, todayISO: string): ExerciseContribution[] {
  const inRange = filterPointsByRange(sessions, rangeKey, todayISO);
  const byName = new Map<string, ExerciseContribution>();
  for (const session of inRange) {
    for (const ex of session.exercises) {
      const name = ex.name.trim();
      if (!name) continue;
      const t = computeExerciseSetTotals(ex);
      const existing = byName.get(name) ?? { name, sets: 0, volume: 0 };
      existing.sets += t.sets;
      existing.volume += Math.round(t.volume);
      byName.set(name, existing);
    }
  }
  return [...byName.values()];
}

export interface RecentRecord {
  exerciseName: string;
  type: "1RM" | "volume" | "reps" | "weight";
  label: string;
  value: string;
  date: string;
}

// Scans every distinct exercise ever logged and surfaces whichever of its
// all-time bests (heaviest weight, est. 1RM, best single-set volume, best
// single-set reps) were actually set within the trailing window — the data
// source for the dashboard's Recent Records section. Newest first.
export function getRecentRecords(sessions: WorkoutSessionSummary[], sinceDaysAgo: number, todayISO: string): RecentRecord[] {
  const names = new Set<string>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const n = ex.name.trim();
      if (n) names.add(n);
    }
  }

  const cutoff = cutoffDateString(sinceDaysAgo, todayISO);
  const records: RecentRecord[] = [];
  for (const name of names) {
    const stats = getExerciseStats(sessions, name);
    if (stats.heaviestWeight && stats.heaviestWeight.date >= cutoff) {
      records.push({ exerciseName: name, type: "weight", label: "Heaviest weight", value: stats.heaviestWeight.weightStr, date: stats.heaviestWeight.date });
    }
    if (stats.estimatedOneRepMax && stats.estimatedOneRepMax.date >= cutoff) {
      records.push({ exerciseName: name, type: "1RM", label: "Est. 1RM", value: `${stats.estimatedOneRepMax.value} kg`, date: stats.estimatedOneRepMax.date });
    }
    if (stats.bestSetVolume && stats.bestSetVolume.date >= cutoff) {
      records.push({ exerciseName: name, type: "volume", label: "Best set volume", value: `${stats.bestSetVolume.value} kg`, date: stats.bestSetVolume.date });
    }
    if (stats.bestSetReps && stats.bestSetReps.date >= cutoff) {
      records.push({ exerciseName: name, type: "reps", label: "Best set reps", value: `${stats.bestSetReps.reps} reps`, date: stats.bestSetReps.date });
    }
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export interface RecentRecordWeek {
  weekStartISO: string;
  label: string;
  records: RecentRecord[];
}

// Buckets records into Monday-start weeks so a long history reads as a
// scannable set of sections instead of one endless flat list.
export function groupRecordsByWeek(records: RecentRecord[]): RecentRecordWeek[] {
  const byWeek = new Map<string, RecentRecord[]>();
  for (const r of records) {
    const [y, m, d] = r.date.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const weekday = (date.getUTCDay() + 6) % 7; // 0 = Monday
    date.setUTCDate(date.getUTCDate() - weekday);
    const weekStartISO = date.toISOString().slice(0, 10);
    const list = byWeek.get(weekStartISO) ?? [];
    list.push(r);
    byWeek.set(weekStartISO, list);
  }
  return Array.from(byWeek.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekStartISO, weekRecords]) => ({
      weekStartISO,
      label: `Week of ${new Date(`${weekStartISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
      records: weekRecords,
    }));
}
