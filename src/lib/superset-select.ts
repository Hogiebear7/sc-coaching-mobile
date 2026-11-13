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
