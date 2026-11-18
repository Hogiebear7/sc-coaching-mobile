import type { PrescribedExercise, PrescribedSet } from "@/lib/queries/programs";
import type { ExerciseSection, WorkoutSetType } from "@/lib/queries/workouts";
import type { ExerciseRow, SetRow } from "@/lib/workout-draft";

// A workout template is edited with the same cards as a live workout (WorkoutBlock and ExerciseEditCard), so while it is being edited each exercise is an
// ExerciseRow like the logging screen's, and it is converted to and from the saved shape (PrescribedExercise) here. Pure: no React, no network.

/** An exercise row in the template editor. `tags` carries the muscle tags a template already had, so saving does not lose them. */
export type TemplateRow = ExerciseRow & { tags?: string[] };

let keySeq = 0;
export function nextRowKey(): string {
  keySeq += 1;
  return `tpl-${Date.now()}-${keySeq}`;
}

export function newSetRow(setType: WorkoutSetType = "standard"): SetRow {
  return { key: nextRowKey(), weight: "", reps: "", repsRight: "", repsLeft: "", setType, completed: false };
}

export function newTemplateRow(sets = 3): TemplateRow {
  return {
    key: nextRowKey(),
    exerciseId: null,
    name: "",
    notes: "",
    rir: "",
    setRows: Array.from({ length: Math.max(1, sets) }, () => newSetRow()),
    unitMode: "weight",
    defaultSetType: "standard",
    supersetGroup: null,
    perSide: false,
  };
}

// A section is saved as a muscle tag ("section:upper_push") so it travels with the template without a new field.
const SECTION_TAG = "section:";
const SECTIONS: ExerciseSection[] = ["upper_push", "upper_pull", "lower_push", "lower_pull", "core", "cardio"];

// A per-side rep target is saved as one text ("R8 / L6"), the same way the old template builder did.
const PER_SIDE = /^R(.*) \/ L(.*)$/;
const NUMERIC_WEIGHT = /^\s*\d+(\.\d+)?\s*(kg|lb|lbs)?\s*$/i;
const CLOCK = /^\d+:\d{2}$/;

export function parseTargetReps(value: string | null | undefined): { reps: string; repsRight: string; repsLeft: string; perSide: boolean; extra: string | null } {
  const text = value?.trim() ?? "";
  if (!text) return { reps: "", repsRight: "", repsLeft: "", perSide: false, extra: null };
  const side = text.match(PER_SIDE);
  if (side) return { reps: "", repsRight: side[1].trim(), repsLeft: side[2].trim(), perSide: true, extra: null };
  if (/^\d+$/.test(text)) return { reps: text, repsRight: "", repsLeft: "", perSide: false, extra: null };
  // Free text ("8-10", "AMRAP") cannot go in a number box, so it is kept as a note instead of being lost.
  return { reps: "", repsRight: "", repsLeft: "", perSide: false, extra: text };
}

function unitModeFor(weights: (string | null | undefined)[]): ExerciseRow["unitMode"] {
  const filled = weights.map((w) => w?.trim() ?? "").filter(Boolean);
  if (filled.length === 0) return "weight";
  if (filled.every((w) => CLOCK.test(w))) return "time";
  if (filled.every((w) => NUMERIC_WEIGHT.test(w))) return "weight";
  return "band";
}

export function templateToRows(exercises: PrescribedExercise[]): TemplateRow[] {
  return exercises
    .filter((ex) => !ex.conditioningProtocol)
    .map((ex) => {
      const defaultSetType: WorkoutSetType = ex.setType ?? "standard";
      const base = parseTargetReps(ex.targetReps);
      const perSide = base.perSide || (ex.sets ?? []).some((s) => PER_SIDE.test(s.reps?.trim() ?? ""));
      const sets: PrescribedSet[] =
        ex.sets && ex.sets.length > 0
          ? ex.sets
          : Array.from({ length: Math.max(1, ex.targetSets ?? 3) }, () => ({ reps: ex.targetReps, weight: ex.targetWeight, setType: null }));
      const extras: string[] = [];
      const setRows: SetRow[] = sets.map((s) => {
        const r = parseTargetReps(s.reps);
        if (r.extra && !extras.includes(r.extra)) extras.push(r.extra);
        return { ...newSetRow(s.setType ?? defaultSetType), weight: s.weight ?? "", reps: r.reps, repsRight: r.repsRight, repsLeft: r.repsLeft };
      });
      const section = ex.muscleTags.find((t) => t.startsWith(SECTION_TAG))?.slice(SECTION_TAG.length) as ExerciseSection | undefined;
      const notes = [ex.notes?.trim() ?? "", ...extras.map((e) => `Reps: ${e}`)].filter(Boolean).join(" · ");
      return {
        key: nextRowKey(),
        exerciseId: ex.exerciseId,
        name: ex.name,
        notes,
        rir: "",
        setRows,
        unitMode: unitModeFor(sets.map((s) => s.weight)),
        defaultSetType,
        supersetGroup: ex.supersetGroup,
        perSide,
        muscleSection: section && SECTIONS.includes(section) ? section : null,
        tags: ex.muscleTags.filter((t) => !t.startsWith(SECTION_TAG)),
      } satisfies TemplateRow;
    });
}

export function rowsToTemplate(rows: TemplateRow[]): PrescribedExercise[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const repsOf = (sr: SetRow): string | null =>
        r.perSide ? (sr.repsRight.trim() || sr.repsLeft.trim() ? `R${sr.repsRight.trim()} / L${sr.repsLeft.trim()}` : null) : sr.reps.trim() || null;
      const sets: PrescribedSet[] = r.setRows.map((sr) => ({ reps: repsOf(sr), weight: sr.weight.trim() || null, setType: sr.setType === "standard" ? null : sr.setType }));
      const first = sets[0];
      return {
        id: nextRowKey(),
        exerciseId: r.exerciseId,
        name: r.name.trim(),
        muscleTags: [...(r.tags ?? []), ...(r.muscleSection ? [`${SECTION_TAG}${r.muscleSection}`] : [])].slice(0, 8),
        targetSets: sets.length || null,
        targetReps: first?.reps ?? null,
        targetWeight: first?.weight ?? null,
        setType: r.defaultSetType === "standard" ? null : r.defaultSetType,
        sets,
        supersetGroup: r.supersetGroup,
        notes: r.notes.trim() || null,
      };
    });
}
