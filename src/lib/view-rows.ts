import type { WorkoutExerciseEntry, WorkoutRunEntry } from "@/lib/queries/workouts";
import type { ExerciseRow, RunRow, SetRow } from "@/lib/workout-draft";

// A saved workout (history, or someone else's workout in Community) turned back into the rows the workout cards draw, so a finished workout looks exactly like a
// live one, read-only. Pure: no React, no network. Nothing here is saved again.

let seq = 0;
const key = () => `view-${Date.now()}-${++seq}`;

const CLOCK = /^\d+:\d{2}$/;
const NUMERIC = /^\s*\d+(\.\d+)?\s*(kg|lb|lbs)?\s*$/i;

function unitModeFor(weights: (string | null | undefined)[]): ExerciseRow["unitMode"] {
  const filled = weights.map((w) => w?.trim() ?? "").filter(Boolean);
  if (filled.length === 0) return "weight";
  if (filled.every((w) => CLOCK.test(w))) return "time";
  if (filled.every((w) => NUMERIC.test(w))) return "weight";
  return "band";
}

export function entryToRow(ex: WorkoutExerciseEntry): ExerciseRow {
  const details = ex.setDetails && ex.setDetails.length > 0 ? ex.setDetails : null;
  const count = Math.max(1, ex.sets ?? 1);
  const setRows: SetRow[] = details
    ? details.map((d) => ({
        key: key(),
        weight: d.weight ?? "",
        reps: d.reps != null ? String(d.reps) : "",
        repsRight: d.repsRight != null ? String(d.repsRight) : "",
        repsLeft: d.repsLeft != null ? String(d.repsLeft) : "",
        setType: d.setType ?? ex.setType ?? "standard",
        completed: false,
      }))
    : Array.from({ length: count }, () => ({
        key: key(),
        weight: ex.weight ?? "",
        reps: ex.reps != null ? String(ex.reps) : "",
        repsRight: "",
        repsLeft: "",
        setType: ex.setType ?? "standard",
        completed: false,
      }));
  const perSide = ex.perSide === true || setRows.some((s) => !!s.repsRight || !!s.repsLeft);
  return {
    key: key(),
    exerciseId: ex.exerciseId,
    name: ex.name,
    notes: ex.notes ?? "",
    rir: "",
    setRows,
    unitMode: unitModeFor(details ? details.map((d) => d.weight) : [ex.weight]),
    defaultSetType: ex.setType ?? "standard",
    supersetGroup: ex.supersetGroup ?? null,
    perSide,
    order: ex.order ?? null,
    muscleSection: ex.muscleSection ?? null,
  };
}

const fmtDistance = (r: WorkoutRunEntry): string => (r.distance != null ? String(r.distance) : "");
const fmtDuration = (r: WorkoutRunEntry): string => {
  if (r.durationSecs == null) return "";
  const h = Math.floor(r.durationSecs / 3600);
  const m = Math.floor((r.durationSecs % 3600) / 60);
  const s = Math.round(r.durationSecs % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

export function runToRow(r: WorkoutRunEntry): RunRow {
  return {
    key: key(),
    distance: fmtDistance(r),
    distanceUnit: "km",
    duration: fmtDuration(r),
    reps: r.reps != null ? String(r.reps) : "",
    sets: r.sets != null ? String(r.sets) : "",
    notes: r.notes ?? "",
    splits: [],
    cardioType: r.cardioType ?? "run",
    level: r.level != null ? String(r.level) : "",
    order: r.order ?? null,
    supersetGroup: r.supersetGroup ?? null,
    typeChosen: true,
  };
}
