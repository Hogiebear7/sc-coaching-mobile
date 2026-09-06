import type { PrescribedExercise } from "@/lib/queries/programs";
import type { ExerciseLibraryRecord } from "@/lib/queries/exercise-library";
import type { SessionTier } from "@/lib/queries/workout-helper";
import {
  bodyHalfOfBucket,
  classifyMovementBucket,
  isCompoundExercise,
  MAIN_MOVEMENT_BUCKETS,
  type MainMovementBucket,
  type MovementBucket,
} from "@/lib/movement-buckets";

// ~8 minutes per exercise (3 working sets at ~45s each + ~90s rest between,
// plus setup) is a reasonable planning average — not exact, just enough to
// turn "I have 45 minutes" into "that's about 5-6 exercises" rather than
// leaving the member to guess.
const MINUTES_PER_EXERCISE = 8;
const MIN_EXERCISES = 1;
const MAX_EXERCISES = 10;

// Primary muscles get the majority of slots; secondary (if any) fill the
// rest — a "push day" targeting chest primarily with triceps/shoulders
// secondary shouldn't come out as an even three-way split.
const PRIMARY_SHARE = 0.7;

// Mirrors the main repo's Workout Helper tiering (lib/workout-helper.ts):
// full trades volume for heavier/lower-rep work, reduced goes the other
// way and also trims the exercise count so a genuinely light day doesn't
// still hand back a full-length session. Standard is today's original,
// unscaled default — also what's used while the tier hasn't loaded yet, so
// generation never blocks on it.
const SETS_AND_REPS_BY_TIER: Record<SessionTier, { sets: number; reps: string }> = {
  full: { sets: 4, reps: "5-6" },
  standard: { sets: 3, reps: "8-12" },
  reduced: { sets: 2, reps: "12-15" },
};

// Only reduced trims the count — full already gets there via heavier,
// lower-rep sets, not more exercises stacked on a day that might already
// be borderline (readiness, 7-day load, or a heavy session booked/planned).
const SLOT_SCALE_BY_TIER: Record<SessionTier, number> = {
  full: 1,
  standard: 1,
  reduced: 0.75,
};

export interface WorkoutGeneratorInput {
  exercises: ExerciseLibraryRecord[];
  primaryBodyParts: string[];
  secondaryBodyParts: string[];
  /** Empty = no equipment constraint (any). */
  equipment: string[];
  timeMinutes: number;
  /** Today's Workout Helper tier (see useWorkoutHelperTier) — undefined/null
      while it hasn't loaded yet, which generates exactly like "standard"
      always did before this existed. */
  tier?: SessionTier | null;
}

function matchesEquipment(exercise: ExerciseLibraryRecord, equipment: string[]): boolean {
  if (equipment.length === 0) return true;
  // No listed equipment reads as bodyweight/no-equipment-needed — always
  // usable regardless of what the member picked.
  if (!exercise.equipment) return true;
  return equipment.includes(exercise.equipment);
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Distributes `slots` picks across `bodyParts` round-robin (so 3 slots
// across ["chest", "triceps"] alternates rather than exhausting chest
// first), skipping exercises already chosen and body parts with nothing
// left to offer — remaining slots spill to whichever group still has
// candidates rather than coming up short.
function pickForBodyParts(
  bodyParts: string[],
  slots: number,
  candidatesByBodyPart: Map<string, ExerciseLibraryRecord[]>,
  alreadyChosen: Set<string>
): ExerciseLibraryRecord[] {
  const picked: ExerciseLibraryRecord[] = [];
  const pools = new Map(bodyParts.map((bp) => [bp, shuffled(candidatesByBodyPart.get(bp) ?? [])]));

  let madeProgress = true;
  while (picked.length < slots && madeProgress) {
    madeProgress = false;
    for (const bp of bodyParts) {
      if (picked.length >= slots) break;
      const pool = pools.get(bp);
      if (!pool) continue;
      while (pool.length > 0) {
        const candidate = pool.shift()!;
        if (alreadyChosen.has(candidate.id)) continue;
        alreadyChosen.add(candidate.id);
        picked.push(candidate);
        madeProgress = true;
        break;
      }
    }
  }

  return picked;
}

export function generateWorkout(input: WorkoutGeneratorInput): PrescribedExercise[] {
  const { exercises, primaryBodyParts, secondaryBodyParts, equipment, timeMinutes } = input;
  const tier = input.tier ?? "standard";
  const { sets: targetSets, reps: targetReps } = SETS_AND_REPS_BY_TIER[tier];

  const candidatesByBodyPart = new Map<string, ExerciseLibraryRecord[]>();
  for (const e of exercises) {
    if (!e.bodyPart || !matchesEquipment(e, equipment)) continue;
    const list = candidatesByBodyPart.get(e.bodyPart) ?? [];
    list.push(e);
    candidatesByBodyPart.set(e.bodyPart, list);
  }

  const timeBasedSlots = Math.min(
    MAX_EXERCISES,
    Math.max(MIN_EXERCISES, Math.round(timeMinutes / MINUTES_PER_EXERCISE))
  );
  const totalSlots = Math.max(MIN_EXERCISES, Math.round(timeBasedSlots * SLOT_SCALE_BY_TIER[tier]));
  const primarySlots = secondaryBodyParts.length > 0 ? Math.ceil(totalSlots * PRIMARY_SHARE) : totalSlots;
  const secondarySlots = totalSlots - primarySlots;

  const chosenIds = new Set<string>();
  const primaryPicks = pickForBodyParts(primaryBodyParts, primarySlots, candidatesByBodyPart, chosenIds);
  const secondaryPicks =
    secondarySlots > 0 ? pickForBodyParts(secondaryBodyParts, secondarySlots, candidatesByBodyPart, chosenIds) : [];

  // If primary came up short (not enough exercises for the muscles/
  // equipment chosen), let secondary — or even a second pass over primary
  // now that pools have been consumed — fill the gap rather than handing
  // back a workout shorter than what the time budget called for.
  let picks = [...primaryPicks, ...secondaryPicks];
  if (picks.length < totalSlots) {
    const remaining = totalSlots - picks.length;
    const fallbackBodyParts = [...primaryBodyParts, ...secondaryBodyParts];
    picks = [...picks, ...pickForBodyParts(fallbackBodyParts, remaining, candidatesByBodyPart, chosenIds)];
  }

  return picks.map((e) => ({
    id: e.id,
    exerciseId: e.id,
    name: e.name,
    muscleTags: e.bodyPart ? [e.bodyPart] : [],
    targetSets,
    targetReps,
    targetWeight: null,
    setType: "standard",
    sets: null,
    supersetGroup: null,
    notes: null,
  }));
}

// ---------------------------------------------------------------------------
// Structured (compound-first, alternating-antagonist) generator — the new
// default for the "Full Body"/"Upper / Lower" Structure choices. Unlike
// generateWorkout above (kept for "Choose muscle areas" — the member's own
// manual primary/secondary body-part taps), this never asks for body
// parts — it always draws from the 4 main movement-pattern buckets (or just
// 2, for an Upper/Lower session) plus a tempo and a core finisher,
// classified straight from each exercise's existing `taxonomy`. Mirrors
// gym-app's lib/programme-exercise-picker.ts pickStructuredExercisesForDay
// exactly, adapted to this file's tier-based sets/reps scaling.

export type SplitMode = "fullBody" | "upperLower" | "freeform";

export interface StructuredDaySpec {
  mode: "fullBody" | "upperLower";
  /** Required and only meaningful when mode === "upperLower". */
  half?: "upper" | "lower";
}

export interface StructuredWorkoutGeneratorInput {
  exercises: ExerciseLibraryRecord[];
  daySpec: StructuredDaySpec;
  equipment: string[];
  timeMinutes: number;
  tier?: SessionTier | null;
}

interface BucketPool {
  compound: ExerciseLibraryRecord[];
  other: ExerciseLibraryRecord[];
}

function takeFromBucketPool(pool: BucketPool, alreadyChosen: Set<string>): ExerciseLibraryRecord | null {
  while (pool.compound.length > 0) {
    const candidate = pool.compound.shift()!;
    if (!alreadyChosen.has(candidate.id)) {
      alreadyChosen.add(candidate.id);
      return candidate;
    }
  }
  while (pool.other.length > 0) {
    const candidate = pool.other.shift()!;
    if (!alreadyChosen.has(candidate.id)) {
      alreadyChosen.add(candidate.id);
      return candidate;
    }
  }
  return null;
}

// Cycles through bucketSequence, taking one exercise per turn, until `slots`
// are filled or every bucket in the cycle has run dry — an exhausted bucket
// just contributes nothing on its turns, so demand naturally spills onto
// whichever buckets in the cycle still have supply (same shape as
// pickForBodyParts above).
function pickAlongBucketSequence(
  bucketSequence: MovementBucket[],
  slots: number,
  pools: Map<MovementBucket, BucketPool>,
  alreadyChosen: Set<string>
): ExerciseLibraryRecord[] {
  if (bucketSequence.length === 0) return [];
  const picked: ExerciseLibraryRecord[] = [];
  let idx = 0;
  let emptyStreak = 0;
  while (picked.length < slots && emptyStreak < bucketSequence.length) {
    const bucket = bucketSequence[idx % bucketSequence.length];
    idx++;
    const pool = pools.get(bucket);
    const candidate = pool ? takeFromBucketPool(pool, alreadyChosen) : null;
    if (candidate) {
      picked.push(candidate);
      emptyStreak = 0;
    } else {
      emptyStreak++;
    }
  }
  return picked;
}

// Session-length -> (main-slot count, finisher buckets). totalSlots <= 3 has
// no room for a finisher; 4 "periodically" (1-in-3) trades its last main
// slot for one finisher; 5 always gets exactly one finisher; 6+ always gets
// both, pinned last.
function resolveStructuredSlotPlan(totalSlots: number): { mainCount: number; finishers: MovementBucket[] } {
  if (totalSlots <= 3) return { mainCount: totalSlots, finishers: [] };
  if (totalSlots === 4) {
    if (Math.random() < 1 / 3) {
      return { mainCount: 3, finishers: [Math.random() < 0.5 ? "tempo" : "core"] };
    }
    return { mainCount: 4, finishers: [] };
  }
  if (totalSlots === 5) {
    return { mainCount: 4, finishers: [Math.random() < 0.5 ? "tempo" : "core"] };
  }
  return { mainCount: totalSlots - 2, finishers: ["tempo", "core"] };
}

// Builds the cyclable main-bucket order: strict upper/lower alternation,
// covering all available main buckets once per cycle, with no fixed leader
// (order otherwise free) — just randomized which half and which push/pull
// leads.
function buildMainBucketSequence(mainBuckets: MainMovementBucket[], mode: "fullBody" | "upperLower"): MainMovementBucket[] {
  if (mode === "upperLower") return shuffled(mainBuckets);

  const upper = shuffled(mainBuckets.filter((b) => bodyHalfOfBucket(b) === "upper"));
  const lower = shuffled(mainBuckets.filter((b) => bodyHalfOfBucket(b) === "lower"));
  const startHalf: "upper" | "lower" = Math.random() < 0.5 ? "upper" : "lower";

  const sequence: MainMovementBucket[] = [];
  for (let i = 0; i < Math.max(upper.length, lower.length); i++) {
    const first = startHalf === "upper" ? upper[i] : lower[i];
    const second = startHalf === "upper" ? lower[i] : upper[i];
    if (first) sequence.push(first);
    if (second) sequence.push(second);
  }
  return sequence;
}

export function generateStructuredWorkout(input: StructuredWorkoutGeneratorInput): PrescribedExercise[] {
  const { exercises, daySpec, equipment, timeMinutes } = input;
  const tier = input.tier ?? "standard";
  const { sets: targetSets, reps: targetReps } = SETS_AND_REPS_BY_TIER[tier];

  const eligible = exercises.filter((e) => matchesEquipment(e, equipment));

  const pools = new Map<MovementBucket, BucketPool>();
  for (const e of eligible) {
    const bucket = classifyMovementBucket(e.taxonomy);
    if (!bucket) continue;
    const pool = pools.get(bucket) ?? { compound: [], other: [] };
    if (isCompoundExercise(e.taxonomy)) pool.compound.push(e);
    else pool.other.push(e);
    pools.set(bucket, pool);
  }
  for (const pool of pools.values()) {
    pool.compound = shuffled(pool.compound);
    pool.other = shuffled(pool.other);
  }

  const mainBuckets =
    daySpec.mode === "upperLower" ? MAIN_MOVEMENT_BUCKETS.filter((b) => bodyHalfOfBucket(b) === daySpec.half) : MAIN_MOVEMENT_BUCKETS;

  const timeBasedSlots = Math.min(MAX_EXERCISES, Math.max(MIN_EXERCISES, Math.round(timeMinutes / MINUTES_PER_EXERCISE)));
  const totalSlots = Math.max(MIN_EXERCISES, Math.round(timeBasedSlots * SLOT_SCALE_BY_TIER[tier]));
  const { mainCount, finishers } = resolveStructuredSlotPlan(totalSlots);

  const alreadyChosen = new Set<string>();
  const mainSequence = buildMainBucketSequence(mainBuckets, daySpec.mode);
  const mainPicks = pickAlongBucketSequence(mainSequence, mainCount, pools, alreadyChosen);
  const finisherPicks = finishers.flatMap((bucket) => pickAlongBucketSequence([bucket], 1, pools, alreadyChosen));

  const picks = [...mainPicks, ...finisherPicks];

  // Total starvation (extreme equipment restriction, or a library where
  // nothing classifies into any bucket) — fall back to the freeform
  // body-part picker across every body part so a session is never handed
  // back empty, same philosophy as generateWorkout's own fallback pass.
  if (picks.length === 0) {
    const fallbackBodyParts = [...new Set(exercises.map((e) => e.bodyPart).filter((v): v is string => !!v))];
    return generateWorkout({
      exercises,
      primaryBodyParts: fallbackBodyParts,
      secondaryBodyParts: [],
      equipment,
      timeMinutes,
      tier,
    });
  }

  return picks.map((e) => ({
    id: e.id,
    exerciseId: e.id,
    name: e.name,
    muscleTags: e.bodyPart ? [e.bodyPart] : [],
    targetSets,
    targetReps,
    targetWeight: null,
    setType: "standard",
    sets: null,
    supersetGroup: null,
    notes: null,
  }));
}
