import { orderedEntries, renumber, type OrderableRow, type OrderedEntry } from "@/lib/entry-order";

// "Select several, then Make superset". The chosen exercises are brought together (placed where the first one was, in their current order),
// given one label, and the whole workout is numbered again so exercises and cardio keep a clear order. An exercise leaving an older superset
// that is left with only one member goes back to being a plain exercise.

type Row = OrderableRow & { supersetGroup: string | null };

/** The next free "ST<n>" label, given the labels already in the workout. */
export function nextSupersetLabel(groups: (string | null | undefined)[]): string {
  let max = 0;
  for (const g of groups) {
    const m = g?.match(/^ST(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ST${max + 1}`;
}

export function groupSelected<E extends Row, R extends OrderableRow>(
  exerciseRows: E[],
  runRows: R[],
  selectedKeys: ReadonlySet<string>,
  label: string
): { exerciseRows: E[]; runRows: R[] } {
  const entries = orderedEntries(exerciseRows, runRows);
  const picked = entries.filter((e): e is { kind: "exercise"; row: E } => e.kind === "exercise" && selectedKeys.has(e.row.key));
  if (picked.length < 2) return { exerciseRows, runRows };

  const firstAt = entries.findIndex((e) => e.kind === "exercise" && selectedKeys.has(e.row.key));
  const rest = entries.filter((e) => !(e.kind === "exercise" && selectedKeys.has(e.row.key)));
  const insertAt = entries.slice(0, firstAt).filter((e) => !(e.kind === "exercise" && selectedKeys.has(e.row.key))).length;

  const moved: OrderedEntry<E, R>[] = picked.map((p) => ({ kind: "exercise", row: { ...p.row, supersetGroup: label } }));
  const next = [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)];

  // A superset left with a single member is not a superset any more.
  const counts = new Map<string, number>();
  for (const e of next) if (e.kind === "exercise" && e.row.supersetGroup) counts.set(e.row.supersetGroup, (counts.get(e.row.supersetGroup) ?? 0) + 1);
  const cleaned = next.map((e) =>
    e.kind === "exercise" && e.row.supersetGroup && (counts.get(e.row.supersetGroup) ?? 0) < 2 ? ({ kind: "exercise", row: { ...e.row, supersetGroup: null } } as OrderedEntry<E, R>) : e
  );
  return renumber(cleaned);
}

/** Takes every exercise out of one superset. */
export function ungroup<E extends Row>(exerciseRows: E[], label: string): E[] {
  return exerciseRows.map((r) => (r.supersetGroup === label ? { ...r, supersetGroup: null } : r));
}

// Tapping an exercise's number makes it part of a superset. One tap: Superset A (ST1). Two taps: Superset B (ST2), and so on, as far as there are
// exercises to fill them (a superset needs at least two). One more tap takes it out again.

/** The superset labels that can exist for this many exercises: ST1 ... ST<n/2>, since each needs at least two. */
export function availableSupersetLabels(exerciseCount: number): string[] {
  const max = Math.floor(exerciseCount / 2);
  return Array.from({ length: Math.max(0, max) }, (_, i) => `ST${i + 1}`);
}

/** What one more tap gives: the next label in the list, then none. An old label outside the list goes straight to none. */
export function nextSupersetInCycle(current: string | null, exerciseCount: number): string | null {
  const labels = availableSupersetLabels(exerciseCount);
  if (labels.length === 0) return null;
  if (current === null) return labels[0];
  const i = labels.indexOf(current);
  if (i === -1 || i === labels.length - 1) return null;
  return labels[i + 1];
}

/**
 * Gives one exercise a superset label (or none) and, when it joins a superset, brings it next to the other members so the saved order matches
 * what is drawn. The whole workout is numbered again.
 */
export function assignSuperset<E extends Row, R extends OrderableRow>(
  exerciseRows: E[],
  runRows: R[],
  key: string,
  label: string | null
): { exerciseRows: E[]; runRows: R[] } {
  const entries = orderedEntries(exerciseRows, runRows);
  const at = entries.findIndex((e) => e.kind === "exercise" && e.row.key === key);
  if (at === -1) return { exerciseRows, runRows };
  const moved = { kind: "exercise", row: { ...(entries[at].row as E), supersetGroup: label } } as OrderedEntry<E, R>;
  const rest = entries.filter((_, i) => i !== at);
  let insertAt = at;
  if (label !== null) {
    let lastMember = -1;
    rest.forEach((e, i) => {
      if (e.kind === "exercise" && e.row.supersetGroup === label) lastMember = i;
    });
    insertAt = lastMember === -1 ? at : lastMember + 1;
  }
  const next = [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
  return renumber(next);
}

/** Labels shared by fewer than two exercises are cleared (what gets saved: a superset of one is not a superset). */
export function withoutLonelySupersets<E extends Row>(exerciseRows: E[]): E[] {
  const counts = new Map<string, number>();
  for (const r of exerciseRows) if (r.supersetGroup) counts.set(r.supersetGroup, (counts.get(r.supersetGroup) ?? 0) + 1);
  return exerciseRows.map((r) => (r.supersetGroup && (counts.get(r.supersetGroup) ?? 0) < 2 ? { ...r, supersetGroup: null } : r));
}
