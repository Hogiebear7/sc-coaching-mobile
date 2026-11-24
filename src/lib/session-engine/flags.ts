// Works out the engine's flags for an exercise from the library's taxonomy and name. These are rules of thumb: the owner's audit sheet
// (overrides.ts) corrects them where they are wrong, and an override always wins.

import { classifyMovementBucket, isCompoundExercise } from "@/lib/movement-buckets";

import { FLAG_OVERRIDES } from "./overrides";
import type { ExerciseFlags, InjuryArea, Level, LibraryExercise } from "./types";

function tax(taxonomy: Record<string, unknown> | null | undefined, key: string): string {
  const v = taxonomy?.[key];
  return typeof v === "string" ? v : "";
}

function toLevel(value: string | null): Level {
  return value === "advanced" || value === "intermediate" ? value : "beginner";
}

const isBarbellLike = (equipment: string) => /barbell|trap bar|olympic/.test(equipment);
const isFreeWeight = (equipment: string) => /barbell|dumbbell|kettlebell|trap bar|olympic|weighted/.test(equipment);

function gripFor(name: string, equipment: string, position: string): 0 | 1 | 2 | 3 {
  if (/farmer|suitcase|carry/.test(name)) return 3;
  if (/deadlift|rack pull|clean|snatch|good morning/.test(name) && !/machine|smith|cable|single leg/.test(name)) {
    if (/romanian|stiff/.test(name) && !isBarbellLike(equipment)) return 2;
    return isBarbellLike(equipment) ? 3 : 2;
  }
  if (/pull[- ]?up|chin[- ]?up|dead hang|hanging|muscle[- ]?up/.test(name) || position === "hanging") return 2;
  if (/shrug/.test(name) && isFreeWeight(equipment)) return 2;
  if (/swing/.test(name) && /kettlebell/.test(equipment)) return 2;
  if (/\brow\b/.test(name) && isFreeWeight(equipment)) return 2;
  if (isFreeWeight(equipment)) return 1;
  return 0;
}

function impactFor(name: string, mechanic: string, forceType: string, equipment: string): 0 | 1 | 2 {
  if (mechanic === "plyometric" || forceType === "explosive" || /jump|bound|hop|skip|sprint|burpee|\brun\b|running|plyo|high knees|jumping jack|slam|throw|mountain climber/.test(name)) return 2;
  if (/lunge|step[- ]?up|split squat|walking/.test(name)) return 1;
  if (forceType === "locomotion" && !/bike|ski|row|elliptical|stepmill|ergometer/.test(`${name} ${equipment}`)) return 1;
  return 0;
}

function hardnessFor(level: Level, compound: boolean, equipment: string, loadType: string, bucket: string | null, balance: boolean): number {
  let h = level === "advanced" ? 4 : level === "intermediate" ? 3 : 2;
  if (compound && isFreeWeight(equipment) && (bucket === "lower_push" || bucket === "lower_pull")) h += 1;
  else if (compound && isBarbellLike(equipment)) h += 1;
  if (/machine|assisted|band|cable|bodyweight/.test(loadType) && !balance) h -= 1;
  if (!compound) h -= 1;
  return Math.max(1, Math.min(5, h));
}


const STAPLE_YES = /squat|deadlift|romanian|lunge|hip thrust|glute bridge|bench press|push[- ]?up|shoulder press|overhead press|row|pulldown|pull[- ]?up|chin[- ]?up|step[- ]?up|leg press|farmer|carry|swing|good morning/;
const STAPLE_NO = /stability ball|bosu|pin|reverse grip|bradford|w-press|zottman|upright row|behind|svend|jefferson|zercher|sissy|potty|female|slide|platform|frog|cuban|scott|preacher|kickback|curl|extension|fly|flye|raise|shrug|twist|crunch|butt-up|flutter|pullover|one arm .*press|single[- ]arm .*press|lying femoral|kneeling/;

function stapleScore(name: string, equipment: string): number {
  let score = 0;
  if (STAPLE_YES.test(name)) score += 2;
  if (STAPLE_NO.test(name)) score -= 2;
  if (/barbell|dumbbell|kettlebell|body weight|machine|cable|trap bar/.test(equipment)) score += 1;
  return score;
}

type BaseFlags = Omit<ExerciseFlags, "avoidFor" | "pregnancy">;

function avoidAreas(f: BaseFlags, name: string, bodyPart: string, forceType: string, position: string, equipment: string, mechanic: string): InjuryArea[] {
  const out = new Set<InjuryArea>();
  const lunge = /lunge|split squat|step[- ]?up|pistol|bulgarian|single[- ]leg|one[- ]leg/.test(name);
  const calfStanding = bodyPart === "lower legs" && position === "standing";
  // Ankle: anything with impact or balance, standing calf work, and loaded stepping.
  if (f.impact >= 1 || f.balance || calfStanding || lunge) out.add("ankle");
  // Knee: impact, stepping and lunging, deep or unusual knee work.
  if (f.impact >= 1 || lunge || /sissy|spanish|deep|pistol|jump/.test(name)) out.add("knee");
  // Hip: impact, single-leg work and rotation.
  if (f.impact >= 2 || lunge || f.twisting) out.add("hip");
  // Lower back: spine-loaded, bent-over, heavy hinges and twisting.
  if (f.spineLoaded || position === "bent_over" || (forceType === "hip_dominant" && isFreeWeight(equipment)) || f.twisting) out.add("lower_back");
  // Shoulder: overhead, hanging, dips, behind the neck, upright rows.
  if (f.overhead || (f.bucket === "upper_push" && /barbell|smith|trap bar|olympic/.test(equipment)) || (bodyPart === "shoulders" && mechanic === "isolation") || position === "hanging" || /dip\b|behind (the )?neck|upright row|fly\b|flye/.test(name)) out.add("shoulder");
  // Elbow: arm isolation, dips, hanging.
  if (bodyPart === "upper arms" && mechanic === "isolation") out.add("elbow");
  if (/dip\b|hanging/.test(name) || position === "hanging") out.add("elbow");
  // Wrist: hands-on-floor pressing, planks, front rack, handstands, forearm work.
  if (/push[- ]?up|plank|handstand|front squat|clean|wrist|crawl|bear/.test(name) || bodyPart === "lower arms") out.add("wrist");
  // Neck: shrugs, neck work, heavy overhead.
  if (bodyPart === "neck" || /shrug|bridge/.test(name) || (f.overhead && f.hardness >= 4)) out.add("neck");
  return [...out];
}

const cache = new WeakMap<LibraryExercise, ExerciseFlags>();

export function deriveFlags(exercise: LibraryExercise): ExerciseFlags {
  const cached = cache.get(exercise);
  if (cached) return cached;

  const t = exercise.taxonomy;
  const name = exercise.name.toLowerCase();
  const equipment = (exercise.equipment ?? "").toLowerCase();
  const bodyPart = (exercise.bodyPart ?? "").toLowerCase();
  const mechanic = tax(t, "mechanic");
  const forceType = tax(t, "forceType");
  const position = tax(t, "bodyPosition");
  const loadType = tax(t, "loadType");
  const laterality = tax(t, "laterality");
  const level = toLevel(exercise.difficulty);
  const bucket = classifyMovementBucket(t);
  const compound = isCompoundExercise(t);

  const balance =
    (laterality === "unilateral_lower" || /single[- ]leg|one[- ]leg|lunge|split squat|step[- ]?up|pistol|bulgarian/.test(name)) &&
    position !== "seated" &&
    position !== "lying";
  const impact = impactFor(name, mechanic, forceType, equipment);
  const spineLoaded =
    (isBarbellLike(equipment) &&
      position !== "seated" &&
      position !== "lying" &&
      compound &&
      (bucket === "lower_push" || bucket === "lower_pull" || /row|press|clean|snatch|good morning/.test(name))) ||
    /good morning|farmer|carry/.test(name);
  const overhead =
    /overhead|military|push press|jerk|snatch|handstand|arnold|behind (the )?neck|upright row/.test(name) ||
    (bodyPart === "shoulders" && forceType === "push" && position !== "lying");
  const twisting = forceType === "rotation" || forceType === "lateral_flexion" || /twist|rotation|woodchop|wood chop|russian/.test(name);
  const coreFlexion = forceType === "core_flexion" || /crunch|sit[- ]?up/.test(name);

  const base: BaseFlags = {
    bucket,
    level,
    hardness: hardnessFor(level, compound, equipment, loadType, bucket, balance),
    grip: gripFor(name, equipment, position),
    impact,
    spineLoaded,
    supine: position === "lying" || position === "supine",
    prone: position === "prone",
    overhead,
    twisting,
    coreFlexion,
    balance,
    compound,
    staple: stapleScore(name, equipment),
    timed: mechanic === "isometric" || mechanic === "cardio" || forceType === "isometric" || forceType === "carry" || /plank|hold|carry|farmer|bike|ski ?erg|skierg|rower|rowing machine|battle rope|sled|assault|elliptical|stepmill/.test(`${name} ${equipment}`),
    family: tax(t, "movementFamily") || bucket || "other",
  };

  const flags: ExerciseFlags = { ...base, avoidFor: avoidAreas(base, name, bodyPart, forceType, position, equipment, mechanic), pregnancy: null };

  const override = FLAG_OVERRIDES[name];
  const merged = override ? ({ ...flags, ...override } as ExerciseFlags) : flags;
  cache.set(exercise, merged);
  return merged;
}
