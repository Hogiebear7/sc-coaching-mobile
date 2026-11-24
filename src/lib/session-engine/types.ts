// Shared types for the session engine (the rules-based workout generator). See docs in index.ts.

import type { MainMovementBucket, MovementBucket } from "@/lib/movement-buckets";

export type Level = "beginner" | "intermediate" | "advanced";
export type Intent = "strength" | "tempo" | "sport" | "conditioning";
export type SessionFormat = "standard" | "circuit" | "amrap" | "emom" | "tabata" | "chipper";
export type SplitKind = "fullBody" | "upper" | "lower";
export type SessionTier = "full" | "standard" | "reduced";

/** Body areas a member can mark as sore or injured for a session. */
export const INJURY_AREAS = ["ankle", "knee", "hip", "lower_back", "shoulder", "elbow", "wrist", "neck"] as const;
export type InjuryArea = (typeof INJURY_AREAS)[number];

export type PregnancyStage = "first" | "second" | "third";

/** Optional strength benchmarks the member entered themselves. 5-rep bests in kg; the rest are for later features. Used only to suggest a starting weight. */
export interface Benchmarks {
  squat5rmKg?: number | null;
  deadlift5rmKg?: number | null;
  rdl5rmKg?: number | null;
  bench5rmKg?: number | null;
}

/** The exercise-library fields the engine reads (a subset of the app's ExerciseLibraryRecord, so tests can build them cheaply). */
export interface LibraryExercise {
  id: string;
  name: string;
  slug?: string;
  bodyPart: string | null;
  targetMuscle?: string | null;
  equipment: string | null;
  difficulty: string | null;
  approved?: boolean;
  taxonomy: Record<string, unknown> | null;
}

/** What the engine works out about each exercise (from the library's taxonomy and name, then any audit overrides). */
export interface ExerciseFlags {
  bucket: MovementBucket | null;
  level: Level;
  /** 1 (easy complement) to 5 (hardest, goes first). */
  hardness: number;
  /** 0 none, 1 light, 2 medium, 3 high (heavy deadlift, farmer carry). */
  grip: 0 | 1 | 2 | 3;
  /** 0 none, 1 low (lunges, step-ups), 2 high (jumps, running). */
  impact: 0 | 1 | 2;
  spineLoaded: boolean;
  supine: boolean;
  prone: boolean;
  overhead: boolean;
  twisting: boolean;
  coreFlexion: boolean;
  /** Standing on one leg or stepping: a balance demand. */
  balance: boolean;
  compound: boolean;
  /** How much of a classic, simple movement this is: -2 (fancy variation) to +3 (staple). Staples are preferred for main and complement lifts. */
  staple: number;
  /** Done for time (holds, carries, cardio machines) rather than counted reps. */
  timed: boolean;
  /** Same-family exercises (squat variants) are not picked together. */
  family: string;
  /** Areas this exercise should not be given for. */
  avoidFor: InjuryArea[];
  pregnancy: "ok" | "modify" | "avoid" | null;
}

export interface SessionContext {
  tier?: SessionTier | null;
  /** Buckets the member trained hard yesterday (main lifts). Those buckets get no main lift today. */
  trainedYesterday?: MovementBucket[];
  pregnancy?: { stage: PregnancyStage } | null;
  injuries?: InjuryArea[];
  /** True on a low-energy day (for example the menstrual or late-luteal phase with low readiness): lowers the top intensity one notch. */
  lowEnergy?: boolean;
  benchmarks?: Benchmarks | null;
}

export interface SessionRequest {
  level: Level;
  intent: Intent;
  format: SessionFormat;
  split: SplitKind;
  timeMinutes: number;
  /** Vendor equipment strings the member has. Empty means any. */
  equipment: string[];
  /** The member's free-text note for this session. Kept for the rationale; not parsed by the rules. */
  note?: string | null;
  context?: SessionContext;
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  bodyPart: string | null;
  bucket: MovementBucket | null;
  role: "main" | "complement" | "finisher";
  sets: number;
  reps: string;
  /** Suggested starting weight when benchmarks allow, else null (the cue is the RPE in `cue`). */
  weight: string | null;
  setType: "standard" | "dropset";
  /** "A", "B" for exercises that alternate as a superset; null for straight sets. */
  supersetGroup: string | null;
  /** Short coaching cue: RPE, rest, and any note about this exercise. */
  cue: string;
}

export interface SessionPlan {
  exercises: PlannedExercise[];
  /** Plain-language reasons shown with the workout ("Why this session"). */
  notes: string[];
  /** True when constraints left fewer exercises than the time asked for. */
  short: boolean;
}

export type { MainMovementBucket, MovementBucket };
