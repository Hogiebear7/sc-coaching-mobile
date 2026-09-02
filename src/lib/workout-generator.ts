import type { PrescribedExercise } from "@/lib/queries/programs";
import type { ExerciseLibraryRecord } from "@/lib/queries/exercise-library";
import type { SessionTier } from "@/lib/queries/workout-helper";

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
