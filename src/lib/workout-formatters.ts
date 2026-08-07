import type { WorkoutExerciseEntry, WorkoutRunEntry } from "@/lib/queries/workouts";

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
  if (ex.setDetails && ex.setDetails.length > 0) {
    return ex.setDetails
      .map((s) => {
        if (s.weight && s.reps !== null) return `${s.weight}×${s.reps}`;
        if (s.weight) return `${s.weight}`;
        if (s.reps !== null) return `×${s.reps}`;
        return "—";
      })
      .join(", ");
  }
  const parts: string[] = [];
  if (ex.sets !== null && ex.reps !== null) parts.push(`${ex.sets}×${ex.reps}`);
  else if (ex.sets !== null) parts.push(`${ex.sets} sets`);
  else if (ex.reps !== null) parts.push(`${ex.reps} reps`);
  if (ex.weight) parts.push(`@ ${ex.weight}`);
  if (ex.rir != null) parts.push(`RIR ${ex.rir}`);
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
