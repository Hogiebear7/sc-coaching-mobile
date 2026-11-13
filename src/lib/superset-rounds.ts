// The rounds view of a superset. Each exercise keeps its own sets, as always. The rounds view only draws them side by side: set 1 of every exercise in
// the superset is Round 1, set 2 is Round 2, and so on. Nothing saved changes. These helpers work on the group's rows (the exercises of one superset).

interface SetLike {
  key: string;
  completed: boolean;
}

export interface RoundRow<S extends SetLike = SetLike> {
  key: string;
  unitMode: "weight" | "time" | "band";
  setRows: S[];
}

/** The rounds view draws weight and reps only. A superset containing a timed or band exercise stays in the normal view. */
export function canShowRounds(rows: RoundRow[]): boolean {
  return rows.length >= 2 && rows.every((r) => r.unitMode === "weight");
}

/** How many rounds there are: the most sets any exercise in the superset has. */
export function roundCount(rows: RoundRow[]): number {
  return rows.reduce((max, r) => Math.max(max, r.setRows.length), 0);
}

/** A round is done when every exercise has that set and it is ticked. */
export function isRoundComplete(rows: RoundRow[], roundIndex: number): boolean {
  return rows.length > 0 && rows.every((r) => r.setRows[roundIndex]?.completed === true);
}

/** Adds one round: every exercise is first brought up to the same number of sets, then gets one more. */
export function addRound<R extends RoundRow>(rows: R[], makeSet: (row: R) => R["setRows"][number]): R[] {
  const target = roundCount(rows) + 1;
  return rows.map((r) => {
    const sets = [...r.setRows];
    while (sets.length < target) sets.push(makeSet(r));
    return { ...r, setRows: sets };
  });
}

/** Takes the last round off every exercise (never the last one left). */
export function removeLastRound<R extends RoundRow>(rows: R[]): R[] {
  if (roundCount(rows) <= 1) return rows;
  const last = roundCount(rows) - 1;
  return rows.map((r) => (r.setRows.length > last ? { ...r, setRows: r.setRows.slice(0, last) } : r));
}

/** Ticks a whole round, or unticks it when it was already done. Exercises that have no set in that round are left alone. */
export function toggleRound<R extends RoundRow>(rows: R[], roundIndex: number): { rows: R[]; nowComplete: boolean } {
  const nowComplete = !isRoundComplete(rows, roundIndex);
  return {
    nowComplete,
    rows: rows.map((r) => ({
      ...r,
      setRows: r.setRows.map((s, i) => (i === roundIndex ? { ...s, completed: nowComplete } : s)),
    })),
  };
}
