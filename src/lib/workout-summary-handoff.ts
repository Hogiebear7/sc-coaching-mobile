import type { WorkoutSummaryData } from "@/app/workout-summary";

// log-workout.tsx used to hand the just-built summary to workout-summary.tsx
// by JSON-stringifying it into a route param. That works for a one- or
// two-exercise session, but for a large one (many exercises, many sets,
// formatted per-exercise summary strings) the serialized payload grows large
// enough that Android's cross-process navigation-state Bundle — which
// React Navigation persists via Binder IPC — can blow past its ~1MB
// transaction limit and kill the app outright with no JS stack trace to
// show for it. A plain module-level handoff never touches that path: the
// value lives in memory only, for the one render cycle between "just
// created this workout" and "workout-summary reads it back", then is
// cleared so nothing lingers.
let pending: WorkoutSummaryData | null = null;

export function setPendingWorkoutSummary(data: WorkoutSummaryData): void {
  pending = data;
}

// Read-once: the summary screen is only ever reached immediately after
// handleSubmit sets it, so consuming it here means a stale value can't leak
// into some unrelated later visit (e.g. navigating back into this screen
// from history).
export function takePendingWorkoutSummary(): WorkoutSummaryData | null {
  const data = pending;
  pending = null;
  return data;
}
