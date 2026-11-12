// Putting exercises and cardio in one order. A workout keeps its exercises and its cardio as two lists, so cardio could only ever sit after the
// last exercise. Each entry now carries an `order` number, and the screens put the two lists together by it. Entries from before this had no
// number: they keep the old picture (every exercise, then every cardio) until the first time something is added or moved.

export interface OrderableRow {
  key: string;
  order?: number | null;
}

export type EntrySegment<E extends OrderableRow, R extends OrderableRow> =
  | { kind: "exercise"; rows: E[] }
  | { kind: "run"; row: R };

export type OrderedEntry<E extends OrderableRow, R extends OrderableRow> =
  | { kind: "exercise"; row: E }
  | { kind: "run"; row: R };

function hasOrder(row: OrderableRow): boolean {
  return typeof row.order === "number" && Number.isFinite(row.order);
}

/** Every entry in display order. Entries without a number go exercises first, then cardio, after the numbered ones. */
export function orderedEntries<E extends OrderableRow, R extends OrderableRow>(exerciseRows: E[], runRows: R[]): OrderedEntry<E, R>[] {
  type Item = { entry: OrderedEntry<E, R>; order: number; tie: number };
  const items: Item[] = [];
  let tie = 0;
  const unnumberedBase = 1_000_000;
  exerciseRows.forEach((row) => {
    items.push({ entry: { kind: "exercise", row }, order: hasOrder(row) ? (row.order as number) : unnumberedBase, tie: tie++ });
  });
  runRows.forEach((row) => {
    items.push({ entry: { kind: "run", row }, order: hasOrder(row) ? (row.order as number) : unnumberedBase, tie: tie++ });
  });
  items.sort((a, b) => a.order - b.order || a.tie - b.tie);
  return items.map((i) => i.entry);
}

/** The display order cut into pieces: each run of exercises together (so supersets still group) and each cardio entry on its own. */
export function entrySegments<E extends OrderableRow, R extends OrderableRow>(exerciseRows: E[], runRows: R[]): EntrySegment<E, R>[] {
  const out: EntrySegment<E, R>[] = [];
  for (const entry of orderedEntries(exerciseRows, runRows)) {
    if (entry.kind === "run") {
      out.push({ kind: "run", row: entry.row });
    } else {
      const last = out[out.length - 1];
      if (last && last.kind === "exercise") last.rows.push(entry.row);
      else out.push({ kind: "exercise", rows: [entry.row] });
    }
  }
  return out;
}

/**
 * Adds a new entry just after another one (or at the end when no anchor is given or found) and numbers everything 0, 1, 2 ... so the order is
 * explicit from then on. Returns new lists; the inputs are not changed.
 */
export function insertEntry<E extends OrderableRow, R extends OrderableRow>(
  exerciseRows: E[],
  runRows: R[],
  added: { kind: "exercise"; row: E } | { kind: "run"; row: R },
  afterKey: string | null
): { exerciseRows: E[]; runRows: R[] } {
  const current = orderedEntries(exerciseRows, runRows);
  const at = afterKey === null ? -1 : current.findIndex((e) => e.row.key === afterKey);
  const next: OrderedEntry<E, R>[] = at === -1 ? [...current, added] : [...current.slice(0, at + 1), added, ...current.slice(at + 1)];
  return renumber(next);
}

/** Writes 0, 1, 2 ... into every entry in the given order and splits them back into the two lists. */
export function renumber<E extends OrderableRow, R extends OrderableRow>(entries: OrderedEntry<E, R>[]): { exerciseRows: E[]; runRows: R[] } {
  const exerciseRows: E[] = [];
  const runRows: R[] = [];
  entries.forEach((entry, i) => {
    if (entry.kind === "exercise") exerciseRows.push({ ...entry.row, order: i });
    else runRows.push({ ...entry.row, order: i });
  });
  return { exerciseRows, runRows };
}

/** The order number to save for an entry: its place in the whole workout, or null when nothing has numbered it yet. */
export function orderToSave(row: OrderableRow): number | null {
  return hasOrder(row) ? (row.order as number) : null;
}

/** Puts saved entries back together by their order. Entries saved before ordering existed keep exercises-then-cardio. */
export function mergeSavedEntries<E extends { order?: number | null }, R extends { order?: number | null }>(
  exercises: E[],
  runs: R[]
): ({ kind: "exercise"; entry: E } | { kind: "run"; entry: R })[] {
  const ex = exercises.map((entry, i) => ({ kind: "exercise" as const, entry, order: typeof entry.order === "number" ? entry.order : 1_000_000, tie: i }));
  const ru = runs.map((entry, i) => ({ kind: "run" as const, entry, order: typeof entry.order === "number" ? entry.order : 1_000_000, tie: exercises.length + i }));
  return [...ex, ...ru].sort((a, b) => a.order - b.order || a.tie - b.tie).map(({ kind, entry }) => ({ kind, entry }) as { kind: "exercise"; entry: E } | { kind: "run"; entry: R });
}
