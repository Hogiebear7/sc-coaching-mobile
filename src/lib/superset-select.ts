import { distinctGroups } from "@/lib/superset-label";
import { orderedEntries, renumber, type OrderableRow, type OrderedEntry } from "@/lib/entry-order";

// "Select several, then Make superset". The chosen exercises are brought together (placed where the first one was, in their current order),
// given one label, and the whole workout is numbered again so exercises and cardio keep a clear order. An exercise leaving an older superset
// that is left with only one member goes back to being a plain exercise.

type Row = OrderableRow & { supersetGroup: string | null };
/** Cardio can sit in a superset too, so its label is optional (older cardio has none). */
type RunLike = OrderableRow & { supersetGroup?: string | null };

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
export function assignSuperset<E extends Row, R extends RunLike>(
  exerciseRows: E[],
  runRows: R[],
  key: string,
  label: string | null
): { exerciseRows: E[]; runRows: R[] } {
  const entries = orderedEntries(exerciseRows, runRows);
  const at = entries.findIndex((e) => e.row.key === key);
  if (at === -1) return { exerciseRows, runRows };
  const moved = { kind: entries[at].kind, row: { ...entries[at].row, supersetGroup: label } } as OrderedEntry<E, R>;
  const rest = entries.filter((_, i) => i !== at);
  let insertAt = at;
  if (label !== null) {
    let lastMember = -1;
    rest.forEach((e, i) => {
      if ((e.row as RunLike).supersetGroup === label) lastMember = i;
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

/**
 * What one more tap on an exercise's number gives, given every exercise in the order shown. The first tap joins the superset of the exercise
 * directly above (so it lands next in line there: B2 after B1), then the other supersets in the workout, then a brand new one, then none.
 * Returns undefined when nothing is possible yet (a superset needs at least two exercises).
 */
export function nextSupersetTap(ordered: { key: string; supersetGroup: string | null }[], key: string): string | null | undefined {
  const at = ordered.findIndex((r) => r.key === key);
  if (at === -1 || ordered.length < 2) return undefined;
  const current = ordered[at].supersetGroup;
  const above = at > 0 ? ordered[at - 1].supersetGroup : null;
  const groups = distinctGroups(ordered.map((r) => r.supersetGroup));
  const options: string[] = [];
  if (above) options.push(above);
  for (const g of groups) if (!options.includes(g)) options.push(g);
  const fresh = nextSupersetLabel(ordered.map((r) => r.supersetGroup));
  if (groups.length < Math.floor(ordered.length / 2) || (current !== null && groups.length <= Math.floor(ordered.length / 2))) {
    if (!options.includes(fresh)) options.push(fresh);
  }
  if (current === null) return options.length ? options[0] : undefined;
  const i = options.indexOf(current);
  return i === -1 || i === options.length - 1 ? null : options[i + 1];
}

/** Labels shared by fewer than two entries (exercises and cardio together) are cleared. What gets saved: a superset of one is not a superset. */
export function cleanLonelySupersets<E extends Row, R extends RunLike>(exerciseRows: E[], runRows: R[]): { exerciseRows: E[]; runRows: R[] } {
  const counts = new Map<string, number>();
  for (const r of [...exerciseRows, ...runRows]) if (r.supersetGroup) counts.set(r.supersetGroup, (counts.get(r.supersetGroup) ?? 0) + 1);
  const lone = (g: string | null | undefined) => !!g && (counts.get(g) ?? 0) < 2;
  return {
    exerciseRows: exerciseRows.map((r) => (lone(r.supersetGroup) ? { ...r, supersetGroup: null } : r)),
    runRows: runRows.map((r) => (lone(r.supersetGroup) ? { ...r, supersetGroup: null } : r)),
  };
}

/** Takes every exercise and every cardio entry out of one superset. */
export function ungroupAll<E extends Row, R extends RunLike>(exerciseRows: E[], runRows: R[], label: string): { exerciseRows: E[]; runRows: R[] } {
  return {
    exerciseRows: exerciseRows.map((r) => (r.supersetGroup === label ? { ...r, supersetGroup: null } : r)),
    runRows: runRows.map((r) => (r.supersetGroup === label ? { ...r, supersetGroup: null } : r)),
  };
}

/**
 * One tap on an entry's label (see nextSupersetTap). When it moves the entry out of a superset into a brand new one, everything that came after it
 * in the old superset comes along: tapping A3 of A1-A4 makes B1 and B2 of the new superset, leaving A1 and A2 where they were.
 */
export function tapSuperset<E extends Row, R extends RunLike>(
  exerciseRows: E[],
  runRows: R[],
  key: string,
  next: string | null
): { exerciseRows: E[]; runRows: R[] } {
  const entries = orderedEntries(exerciseRows, runRows);
  const at = entries.findIndex((e) => e.row.key === key);
  if (at === -1) return { exerciseRows, runRows };
  const current = (entries[at].row as RunLike).supersetGroup ?? null;
  const usedByOthers = next !== null && entries.some((e) => e.row.key !== key && (e.row as RunLike).supersetGroup === next);
  let result = assignSuperset(exerciseRows, runRows, key, next);
  if (next !== null && current !== null && !usedByOthers) {
    const following = entries.slice(at + 1).filter((e) => (e.row as RunLike).supersetGroup === current).map((e) => e.row.key);
    for (const k of following) result = assignSuperset(result.exerciseRows, result.runRows, k, next);
  }
  return result;
}

/**
 * One tap on an entry's number or label links it with what is above it, or undoes that. No cycling:
 *  - not in a superset, and the entry above is in one: it joins that superset (the next one in line there);
 *  - not in a superset, and the entry above is not in one: the two form a new superset;
 *  - in a superset, not the first of it: it and everything after it in that superset become a new superset (tap A3 to start B1);
 *  - the first of a superset, with another superset directly above: the whole superset joins the one above (undoing a split);
 *  - the first of a superset with nothing in a superset above: it leaves the superset.
 * A superset left with a single entry is dissolved. Returns null when nothing can happen (the first entry in the workout, not in a superset).
 */
export function tapSupersetLabel<E extends Row, R extends RunLike>(
  exerciseRows: E[],
  runRows: R[],
  key: string
): { exerciseRows: E[]; runRows: R[] } | null {
  const entries = orderedEntries(exerciseRows, runRows);
  const at = entries.findIndex((e) => e.row.key === key);
  if (at === -1) return null;
  const groupAt = (i: number): string | null => (entries[i].row as RunLike).supersetGroup ?? null;
  const current = groupAt(at);
  const above = at > 0 ? groupAt(at - 1) : null;
  const fresh = nextSupersetLabel(entries.map((e) => (e.row as RunLike).supersetGroup ?? null));

  let keys: string[];
  let label: string | null;
  if (current === null) {
    if (at === 0) return null;
    if (above) {
      keys = [key];
      label = above;
    } else {
      keys = [entries[at - 1].row.key, key];
      label = fresh;
    }
  } else {
    const members = entries.filter((e) => (e.row as RunLike).supersetGroup === current).map((e) => e.row.key);
    const idx = members.indexOf(key);
    if (idx > 0) {
      keys = members.slice(idx);
      label = fresh;
    } else if (above && above !== current) {
      keys = members;
      label = above;
    } else {
      keys = [key];
      label = null;
    }
  }
  const set = new Set(keys);
  const relabelled = {
    exerciseRows: exerciseRows.map((r) => (set.has(r.key) ? { ...r, supersetGroup: label } : r)),
    runRows: runRows.map((r) => (set.has(r.key) ? { ...r, supersetGroup: label } : r)),
  };
  return cleanLonelySupersets(relabelled.exerciseRows, relabelled.runRows);
}
