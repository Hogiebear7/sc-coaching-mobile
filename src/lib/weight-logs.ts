import type { BodyWeightLog } from "@/lib/queries/body-weight";

/** Oldest first: by date, then by when it was logged, so several entries on one day keep their order. */
export function compareWeightLogs(a: BodyWeightLog, b: BodyWeightLog): number {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
}
