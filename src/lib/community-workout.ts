import type { PrescribedExercise } from "@/lib/queries/programs";
import type { WorkoutExerciseEntry } from "@/lib/queries/workouts";

// Another member's workout, as seen from Community (the full-workout screen reached from "+N more exercises"), and turning it into a template of your own.
// Pure helpers, no React.
//
// Privacy: an exercise's free-text note is the member's own and can say anything ("knee sore today"), so it is never shown to or copied by someone else. The one
// exception is the line the app itself writes for a timed format (AMRAP, EMOM, Circuit, Tabata, Chipper: see format-entries.ts), which is how we know what type
// of workout it was.

export type WorkoutKind = "Circuit" | "EMOM" | "Tabata" | "AMRAP" | "Chipper";

const FORMAT_NOTE = /^(Circuit|EMOM|Tabata|AMRAP|Chipper):\s*(.*)$/;

/** The app-written format line of a note ("AMRAP: 12 min, 5 per round"), or null for anything the member typed. */
export function formatNote(note: string | null | undefined): { kind: WorkoutKind; detail: string } | null {
  const m = note?.trim().match(FORMAT_NOTE);
  return m ? { kind: m[1] as WorkoutKind, detail: m[2].trim() } : null;
}

/** What type of workout this was: a timed format when the app wrote one, otherwise a standard (strength) workout. */
export function workoutKind(exercises: Pick<WorkoutExerciseEntry, "notes">[]): { label: string; detail: string | null } {
  for (const ex of exercises) {
    const f = formatNote(ex.notes);
    if (f) return { label: f.kind, detail: f.detail || null };
  }
  return { label: "Standard", detail: null };
}

/** The note that may be shown to another member: only the app's own format line. */
export function shareableNote(note: string | null | undefined): string | null {
  return formatNote(note) ? (note ?? "").trim() : null;
}

let seq = 0;
const nextId = () => `${Date.now()}-${++seq}`;

/**
 * Template rows for someone else's workout: the exercises in order, with sets, reps, set type and superset groups. Their weights are left blank (a weight that
 * suits them may not suit you; set your own) and their personal notes are left out. The app's format line is kept so an AMRAP or chipper still says what it is.
 */
export function toTemplateExercises(exercises: WorkoutExerciseEntry[]): PrescribedExercise[] {
  return exercises.map((ex) => {
    const firstDetail = ex.setDetails?.find((d) => d.reps !== null && d.reps !== undefined);
    const reps = ex.reps ?? firstDetail?.reps ?? null;
    return {
      id: nextId(),
      exerciseId: ex.exerciseId,
      name: ex.name,
      muscleTags: [],
      targetSets: ex.sets ?? ex.setDetails?.length ?? null,
      targetReps: ex.perSide && reps !== null ? `R${reps} / L${reps}` : reps !== null ? String(reps) : null,
      targetWeight: null,
      setType: ex.setType ?? null,
      sets: null,
      supersetGroup: ex.supersetGroup ?? null,
      notes: shareableNote(ex.notes),
    };
  });
}
