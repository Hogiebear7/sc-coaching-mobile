// Pure presentation-formatting helpers for the Community screens (feed,
// workout detail, leaderboard). No React Native imports, no navigation, no
// API calls, no device/filesystem access — deterministic input → output
// only, so these can run under plain Vitest without any RN test harness.
// See src/lib/workout-formatters.ts for the equivalent split on the
// workout-logging side of the app.

import type { WorkoutExerciseEntry, WorkoutRunEntry } from "@/lib/queries/workouts";
import { formatExerciseLoad, formatRun } from "@/lib/workout-formatters";

// A workout session's title is free text the member or a class template
// typed — always render through this rather than trusting it directly, so a
// blank/whitespace-only title never collapses a feed card's headline line
// to nothing.
export function formatWorkoutTitle(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  return trimmed || "Workout";
}

export type CommunityDateStyle = "compact" | "short" | "long";

// Consolidates three near-duplicate `new Date(iso).toLocaleDateString(...)`
// call sites (feed card, workout detail, comment timestamp) into one place,
// and — unlike a bare toLocaleDateString call — never lets an unparseable
// or missing date string reach the screen as the literal text "Invalid
// Date": each style has its own explicit fallback instead.
export function formatCommunityDate(dateISO: string | null | undefined, style: CommunityDateStyle): string {
  if (!dateISO) return style === "long" ? "Date unknown" : "—";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return style === "long" ? "Date unknown" : "—";

  if (style === "compact") return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (style === "short") return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

// Safe display for a numeric stat that may be missing, non-finite, or
// (defensively) negative from a bad reading — the leaderboard's value and
// bodyweight-% columns both come from computed data, not direct user input,
// but should never render "NaN" or "undefined" if something upstream ever
// produces one.
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString();
}

// Shared guard behind both formatPbHeadline (Member Wins / Activity) and the
// workout-detail PB badge: trims a personal-best exercise name, or reports
// it missing (null) rather than rendering blank. Shouldn't happen given how
// the backend pairs isPersonalBest with personalBestExercise, but nothing
// enforces that pairing at the type level.
export function formatPbExerciseName(exerciseName: string | null | undefined): string | null {
  const trimmed = (exerciseName ?? "").trim();
  return trimmed || null;
}

export interface PbHeadline {
  /** Rendered bold in the Member Wins row — kept separate from `rest` so
      the caller can still visually emphasize the author's name. */
  author: string;
  /** "hit a new Back Squat PB" — everything after the author's name. */
  rest: string;
}

// The Member Wins sentence, split so the UI can still bold just the
// author's name (unchanged from before this helper existed) while the
// exercise-name handling goes through one tested function.
export function formatPbHeadline(authorName: string, exerciseName: string | null | undefined): PbHeadline {
  const author = authorName.trim() || "A member";
  const name = formatPbExerciseName(exerciseName);
  return { author, rest: name ? `hit a new ${name} PB` : "hit a new PB" };
}

export interface ActivitySummary {
  /** Up to `maxLines` compact "name — load" / "Run — pace" lines. */
  lines: string[];
  /** Exercises + runs beyond what fit in `lines` — the "+N more" count. */
  hiddenCount: number;
}

// The feed card's compact preview: prioritizes exercises before runs (the
// common case), fills remaining slots with runs, and reports exactly how
// many entries didn't make the cut so "+N more" is never a guess. Pulled
// out of FeedCard's render body so the slicing/counting math — the part
// that's actually worth a regression test — doesn't depend on JSX.
export function formatActivitySummary(
  exercises: WorkoutExerciseEntry[],
  runs: WorkoutRunEntry[],
  maxLines: number
): ActivitySummary {
  const previewExercises = exercises.slice(0, maxLines);
  const remainingSlots = Math.max(0, maxLines - previewExercises.length);
  const previewRuns = runs.slice(0, remainingSlots);

  const lines = [
    ...previewExercises.map((ex) => `${ex.name.trim() || "Exercise"} — ${formatExerciseLoad(ex) || "logged"}`),
    ...previewRuns.map((run) => `Run — ${formatRun(run)}`),
  ];

  const hiddenCount = exercises.length + runs.length - previewExercises.length - previewRuns.length;
  return { lines, hiddenCount: Math.max(0, hiddenCount) };
}

export type LeaderboardMetric = "volume" | "squat" | "bench" | "deadlift";
export type LeaderboardRange = "week" | "month" | "year" | "all" | "custom";

const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  volume: "Volume",
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
};

// "Volume · This week" / "Squat · This month" / "Deadlift · All time" — a
// single unambiguous line to sit right above the leaderboard entries, so
// the selected metric/range doesn't rely on noticing which of eight small
// chips is highlighted. Custom range reports the actual bound(s) picked
// rather than the word "Custom", since that's what's actually ambiguous —
// "Custom" alone doesn't say which dates.
export function formatLeaderboardContextLabel(
  metric: LeaderboardMetric,
  range: LeaderboardRange,
  customStartISO: string | null,
  customEndISO: string | null
): string {
  const metricLabel = METRIC_LABEL[metric];
  if (range === "all") return `${metricLabel} · All time`;
  if (range === "week") return `${metricLabel} · This week`;
  if (range === "month") return `${metricLabel} · This month`;
  if (range === "year") return `${metricLabel} · This year`;

  if (!customStartISO && !customEndISO) return `${metricLabel} · Custom range`;
  const startLabel = customStartISO ? formatCommunityDate(customStartISO, "compact") : "the start";
  const endLabel = customEndISO ? formatCommunityDate(customEndISO, "compact") : "today";
  return `${metricLabel} · ${startLabel} – ${endLabel}`;
}

export interface LeaderboardEntryInput {
  userId: string;
  displayName: string;
  value: number;
  bodyweightPct: number | null;
}

export interface LeaderboardRow {
  userId: string;
  rank: number;
  /** "You" when this row is the viewer, the (possibly duplicate) display
      name otherwise — never collapsed with another row on name alone. */
  name: string;
  isMe: boolean;
  valueLabel: string;
  bodyweightLabel: string | null;
}

// Maps raw leaderboard entries to view rows, 1:1 by array position — no
// grouping/keying by displayName anywhere in this function. Two entries
// with the same name but different userId always produce two separate
// rows; this is the thing a regression test actually pins down, since a
// `Map<name, entry>`-style dedupe would silently pass everything else here
// and only show up as one member's score overwriting another's.
export function buildLeaderboardRows(entries: LeaderboardEntryInput[], myUserId: string | null): LeaderboardRow[] {
  return entries.map((entry, i) => ({
    userId: entry.userId,
    rank: i + 1,
    name: entry.userId === myUserId ? "You" : entry.displayName,
    isMe: entry.userId === myUserId,
    valueLabel: `${formatCount(entry.value)} kg`,
    bodyweightLabel: entry.bodyweightPct !== null ? `${entry.bodyweightPct}% BW` : null,
  }));
}
