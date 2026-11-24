// Small helpers that turn the app's own data into the engine's context.

import { deriveFlags } from "./flags";
import type { LibraryExercise, MovementBucket, PregnancyStage } from "./types";

const MAIN: MovementBucket[] = ["upper_push", "upper_pull", "lower_push", "lower_pull"];

/** The local calendar date (YYYY-MM-DD), `daysAgo` days back. */
export function localISODate(daysAgo = 0, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Movement groups the member trained with a compound lift on the given day (so today's session can avoid a repeat). */
export function trainedBuckets(
  sessions: { date: string; exercises: { exerciseId: string | null }[] }[],
  library: LibraryExercise[],
  dateISO: string,
): MovementBucket[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  const out = new Set<MovementBucket>();
  for (const session of sessions) {
    if (session.date.slice(0, 10) !== dateISO) continue;
    for (const entry of session.exercises) {
      const ex = entry.exerciseId ? byId.get(entry.exerciseId) : undefined;
      if (!ex) continue;
      const f = deriveFlags(ex);
      if (f.compound && f.bucket && MAIN.includes(f.bucket)) out.add(f.bucket);
    }
  }
  return [...out];
}

/** The app's trimester (1, 2, 3 or "postpartum") to the engine's pregnancy stage; null when not pregnant. */
export function pregnancyStageFromTrimester(isPregnant: boolean | undefined, trimester: 1 | 2 | 3 | "postpartum" | null | undefined): PregnancyStage | null {
  if (!isPregnant) return null;
  if (trimester === 1) return "first";
  if (trimester === 2) return "second";
  if (trimester === 3) return "third";
  return null;
}
