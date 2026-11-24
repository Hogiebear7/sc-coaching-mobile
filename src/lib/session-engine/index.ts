// Session engine: builds a workout from rules, not chance.
//
//  1. Safety first, never relaxed: equipment, the member's level (capped in pregnancy), pregnancy stage, and any sore or injured areas filter the
//     exercise library down to what is safe to offer.
//  2. Structure: hard lift, then a lighter exercise for the opposite movement (upper pull then lower push, upper push then lower pull, lower push then
//     upper pull, lower pull then upper push), then back to a hard lift and its partner. Conditioning or tempo sessions add a cardio-style exercise
//     after a pair, or a core exercise when the previous two were high tempo.
//  3. Grip is budgeted across the whole session so one grip-heavy lift does not ruin another (see GRIP_* below).
//  4. Every exercise gets sets, reps, an effort target (RPE) and rest, and a starting weight when benchmarks allow.
//  5. A plain-language "why this session" list explains the choices.
//
// The pick is seeded by `rng` so tests are repeatable. Nothing here calls the network or an AI model.

import type { MovementBucket } from "@/lib/movement-buckets";

import { deriveFlags } from "./flags";
import { effectiveLevel, injuryBlock, levelAllowed, pregnancyBlock, rpeCap } from "./rules";
import type {
  ExerciseFlags,
  InjuryArea,
  Intent,
  LibraryExercise,
  PlannedExercise,
  PregnancyStage,
  SessionFormat,
  SessionPlan,
  SessionRequest,
  SplitKind,
} from "./types";
import { suggestWeight } from "./weights";

export * from "./types";
export { deriveFlags } from "./flags";
export { suggestWeight } from "./weights";

const MINUTES_PER_EXERCISE = 8;
const MIN_SLOTS = 3;
const MAX_SLOTS = 8;

/** Two adjacent exercises may not add up to more than this grip score (a 3 can sit beside a 1, never beside another 3 or a 2). */
const GRIP_ADJACENT_MAX = 4;
/** The most grip score a whole session may spend. */
const GRIP_SESSION_MAX = 7;

const COMPLEMENT: Record<string, MovementBucket> = {
  upper_pull: "lower_push",
  upper_push: "lower_pull",
  lower_push: "upper_pull",
  lower_pull: "upper_push",
};

const BUCKET_LABEL: Record<string, string> = {
  upper_push: "upper-body push",
  upper_pull: "upper-body pull",
  lower_push: "squat and knee-dominant leg",
  lower_pull: "hinge and hamstring",
  core: "core",
  tempo: "cardio",
};

type Role = "main" | "complement" | "finisher" | "accessory";
interface Slot {
  role: Role;
  bucket: MovementBucket;
  /** For a complement: the main lift it follows. */
  pairWith?: number;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickFrom<T>(items: T[], rng: () => number, top = 3): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(rng() * Math.min(top, items.length))];
}

function matchesEquipment(exercise: LibraryExercise, equipment: string[]): boolean {
  if (equipment.length === 0) return true;
  if (!exercise.equipment) return true;
  return equipment.includes(exercise.equipment);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Layout: which buckets, in which order, fill the session.
// ---------------------------------------------------------------------------------------------------------------------------------------------

function pairBuckets(split: SplitKind): [MovementBucket, MovementBucket][] {
  if (split === "upper") return [["upper_push", "upper_pull"], ["upper_pull", "upper_push"]];
  if (split === "lower") return [["lower_push", "lower_pull"], ["lower_pull", "lower_push"]];
  return [["lower_push", COMPLEMENT.lower_push], ["upper_push", COMPLEMENT.upper_push]];
}

function buildLayout(split: SplitKind, intent: Intent, totalSlots: number, trainedYesterday: Set<MovementBucket>, rng: () => number): Slot[] {
  let pairs = pairBuckets(split);
  // A bucket trained hard yesterday cannot lead a pair today: put the other pair first if the first leader was trained.
  if (pairs.length === 2 && trainedYesterday.has(pairs[0][0]) && !trainedYesterday.has(pairs[1][0])) pairs = [pairs[1], pairs[0]];
  else if (pairs.length === 2 && trainedYesterday.has(pairs[0][0]) === trainedYesterday.has(pairs[1][0]) && rng() < 0.5) pairs = [pairs[1], pairs[0]];

  const slots: Slot[] = [];
  const addPair = (given: [MovementBucket, MovementBucket]) => {
    // If the pair's lead bucket was trained hard yesterday, its partner leads and the trained bucket becomes the light complement.
    const pair: [MovementBucket, MovementBucket] = trainedYesterday.has(given[0]) && !trainedYesterday.has(given[1]) ? [given[1], given[0]] : given;
    slots.push({ role: "main", bucket: pair[0] });
    slots.push({ role: "complement", bucket: pair[1], pairWith: slots.length - 1 });
  };
  const mainBuckets = [...new Set(pairs.flatMap((p) => p))];
  const accessoryBucket = (i: number): MovementBucket => mainBuckets[i % mainBuckets.length];

  const heavyIntent = intent === "tempo" || intent === "conditioning";
  addPair(pairs[0]);
  if (heavyIntent) slots.push({ role: "finisher", bucket: "tempo" });
  addPair(pairs[1]);
  if (heavyIntent) {
    // Core after a tempo block, cardio again after that.
    slots.push({ role: "finisher", bucket: "core" });
    slots.push({ role: "finisher", bucket: "tempo" });
    slots.push({ role: "accessory", bucket: accessoryBucket(0) });
  } else if (intent === "sport") {
    slots.push({ role: "finisher", bucket: "tempo" });
    slots.push({ role: "finisher", bucket: "core" });
    slots.push({ role: "accessory", bucket: accessoryBucket(0) });
  } else {
    slots.push({ role: "finisher", bucket: "core" });
    slots.push({ role: "accessory", bucket: accessoryBucket(1) });
    slots.push({ role: "accessory", bucket: accessoryBucket(0) });
  }

  // Trim to the time available. Very short: keep a main, its partner, and the next main.
  const count = Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, totalSlots));
  return slots.slice(0, count).map((slot, i, all) => (slot.pairWith !== undefined && slot.pairWith >= all.length ? { ...slot, pairWith: undefined } : slot));
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Prescription: sets, reps, effort, rest.
// ---------------------------------------------------------------------------------------------------------------------------------------------

interface Rx {
  sets: number;
  reps: string;
  rpe: number;
  rest: string;
}

function prescribe(role: Role, f: ExerciseFlags, level: string, intent: Intent, reduced: boolean): Rx {
  const beginner = level === "beginner";
  const advanced = level === "advanced";
  let rx: Rx;
  if (role === "finisher" || (f.timed && role !== "main")) {
    rx = f.bucket === "core" && !f.timed ? { sets: 3, reps: "12-15", rpe: 7, rest: "rest 30-45 sec" } : { sets: 3, reps: "30-40 sec", rpe: 8, rest: "rest 30-45 sec" };
  } else if (role === "accessory") {
    rx = { sets: 3, reps: beginner ? "12-15" : "10-12", rpe: 7, rest: "rest 45-60 sec" };
  } else if (intent === "strength") {
    rx =
      role === "main"
        ? beginner
          ? { sets: 3, reps: "8", rpe: 6, rest: "rest 90 sec to 2 min" }
          : advanced
            ? { sets: 4, reps: "3-5", rpe: 8, rest: "rest 2-3 min" }
            : { sets: 4, reps: "5-6", rpe: 7, rest: "rest 2 min" }
        : { sets: 3, reps: beginner ? "10-12" : "8-10", rpe: beginner ? 6 : 7, rest: "rest 60-90 sec" };
  } else if (intent === "sport") {
    rx =
      role === "main"
        ? beginner
          ? { sets: 3, reps: "6-8", rpe: 6, rest: "rest 90 sec" }
          : { sets: 4, reps: "4-6", rpe: 7, rest: "rest 90 sec to 2 min, move fast on every rep" }
        : { sets: 3, reps: "8", rpe: 7, rest: "rest 60 sec" };
  } else if (intent === "tempo") {
    rx = role === "main" ? { sets: 3, reps: "10-12", rpe: 7, rest: "rest 45-60 sec" } : { sets: 3, reps: "12-15", rpe: 7, rest: "rest 30-45 sec" };
  } else {
    rx = role === "main" ? { sets: 3, reps: "12-15", rpe: 7, rest: "rest 30-45 sec" } : { sets: 3, reps: "15", rpe: 7, rest: "rest 30 sec" };
  }
  if (f.timed && role === "main") rx = { ...rx, reps: "30-40 sec" };
  if (reduced) rx = { ...rx, sets: Math.max(2, rx.sets - 1), rpe: rx.rpe - 1 };
  return rx;
}

function firstRep(reps: string): number {
  const m = /\d+/.exec(reps);
  return m ? Number(m[0]) : 8;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The engine.
// ---------------------------------------------------------------------------------------------------------------------------------------------

export function generateSession(library: LibraryExercise[], request: SessionRequest, rng: () => number = Math.random): SessionPlan {
  const ctx = request.context ?? {};
  const stage: PregnancyStage | null = ctx.pregnancy?.stage ?? null;
  const injuries: InjuryArea[] = ctx.injuries ?? [];
  const reduced = ctx.tier === "reduced";
  const lowEnergy = ctx.lowEnergy === true;
  const trainedYesterday = new Set<MovementBucket>(ctx.trainedYesterday ?? []);
  const level = effectiveLevel(request.level, stage);
  const effortCap = rpeCap(stage, lowEnergy, reduced);

  // 1. Safety filter. Counts of what was left out feed the explanation.
  const skipped = { pregnancy: new Set<string>(), injury: new Set<InjuryArea>() };
  const safe: { ex: LibraryExercise; f: ExerciseFlags }[] = [];
  for (const ex of library) {
    if (ex.approved === false || !matchesEquipment(ex, request.equipment)) continue;
    const f = deriveFlags(ex);
    if (!f.bucket || f.hidden) continue;
    if (!levelAllowed(f.level, level)) continue;
    if (stage) {
      const reason = pregnancyBlock(f, stage);
      if (reason) {
        skipped.pregnancy.add(reason);
        continue;
      }
    }
    const area = injuryBlock(f, injuries);
    if (area) {
      skipped.injury.add(area);
      continue;
    }
    safe.push({ ex, f });
  }

  // Non-standard formats (circuit, AMRAP, EMOM, tabata, chipper) use simple, low-skill movements and a fixed station count.
  const formatted = request.format !== "standard";
  const pool = formatted ? safe.filter(({ f }) => f.hardness <= 3 && !f.spineLoaded && f.grip <= 1 && !(f.balance && level === "beginner")) : safe;

  // 2. Layout.
  const rawSlots = Math.round(request.timeMinutes / MINUTES_PER_EXERCISE);
  const totalSlots = Math.max(MIN_SLOTS, Math.round(rawSlots * (reduced ? 0.75 : 1)));
  let layout: Slot[];
  if (formatted) {
    const stations: Record<SessionFormat, number> = { standard: 0, circuit: 6, amrap: 4, emom: 4, tabata: 4, chipper: 6 };
    const order: MovementBucket[] = request.split === "upper" ? ["upper_push", "upper_pull"] : request.split === "lower" ? ["lower_push", "lower_pull"] : ["lower_push", "upper_pull", "tempo", "upper_push", "lower_pull", "core"];
    layout = Array.from({ length: stations[request.format] }, (_, i) => ({ role: "complement" as Role, bucket: order[i % order.length] }));
  } else {
    layout = buildLayout(request.split, request.intent, totalSlots, trainedYesterday, rng);
  }

  // 3. Fill the layout.
  const chosen: { ex: LibraryExercise; f: ExerciseFlags; slot: Slot; gripManaged: boolean }[] = [];
  const usedIds = new Set<string>();
  const usedFamilies = new Set<string>();
  let gripTotal = 0;

  function candidatesFor(slot: Slot, relax: number) {
    return pool.filter(({ ex, f }) => {
      if (f.bucket !== slot.bucket || usedIds.has(ex.id)) return false;
      if (relax < 1 && usedFamilies.has(f.family) && slot.bucket !== "tempo" && slot.bucket !== "core") return false;
      // A bucket trained hard yesterday: no main lift from it, only a light complement or accessory.
      if (trainedYesterday.has(slot.bucket)) {
        if (slot.role === "main") return false;
        if ((slot.role === "complement" || slot.role === "accessory") && f.hardness > 2) return false;
      }
      const prev = chosen[chosen.length - 1];
      if (prev && prev.f.grip + f.grip > GRIP_ADJACENT_MAX) return false;
      if (relax < 2 && gripTotal + f.grip > GRIP_SESSION_MAX) return false;
      return true;
    });
  }

  for (const slot of layout) {
    let found: { ex: LibraryExercise; f: ExerciseFlags } | null = null;
    for (let relax = 0; relax <= 2 && !found; relax++) {
      const cands = candidatesFor(slot, relax);
      if (cands.length === 0) continue;
      let ranked: typeof cands;
      if (formatted) {
        ranked = shuffle(cands, rng).sort(
          (a, b) => Number(b.f.compound) - Number(a.f.compound) || b.f.staple - a.f.staple || Number(b.f.impact === 0) - Number(a.f.impact === 0),
        );
      } else if (slot.role === "main") {
        ranked = shuffle(cands, rng).sort((a, b) => Number(b.f.compound) - Number(a.f.compound) || b.f.staple - a.f.staple || b.f.hardness - a.f.hardness);
      } else if (slot.role === "complement") {
        const main = slot.pairWith !== undefined ? chosen.find((c) => c.slot === layout[slot.pairWith!]) : undefined;
        const target = Math.max(1, (main?.f.hardness ?? 3) - 1);
        ranked = shuffle(cands, rng)
          .filter(({ f }) => (!main || f.hardness < main.f.hardness) && f.hardness <= 3)
          .sort((a, b) => Number(b.f.compound) - Number(a.f.compound) || b.f.staple - a.f.staple || Math.abs(a.f.hardness - target) - Math.abs(b.f.hardness - target));
        if (ranked.length === 0) ranked = shuffle(cands, rng);
      } else if (slot.role === "accessory") {
        ranked = shuffle(cands, rng).sort((a, b) => a.f.hardness - b.f.hardness || b.f.staple - a.f.staple);
      } else {
        // Finisher: gentlest first for beginners (machines, no impact), anything otherwise.
        ranked = shuffle(cands, rng);
        if (level === "beginner" || slot.bucket === "core") ranked.sort((a, b) => a.f.impact - b.f.impact || Number(a.f.twisting) - Number(b.f.twisting) || b.f.staple - a.f.staple || a.f.hardness - b.f.hardness);
      }
      found = pickFrom(ranked, rng);
    }
    if (!found) continue;
    const prev = chosen[chosen.length - 1];
    const gripManaged = !!prev && prev.f.grip + found.f.grip >= GRIP_ADJACENT_MAX && found.f.grip > 0;
    chosen.push({ ...found, slot, gripManaged });
    usedIds.add(found.ex.id);
    usedFamilies.add(found.f.family);
    gripTotal += found.f.grip;
  }

  // 4. Prescribe.
  const pairing = !formatted && stage === null && level !== "beginner" && (request.intent !== "strength" || request.timeMinutes <= 30);
  const lastComplementIndex = chosen.map((c) => c.slot.role).lastIndexOf("complement");
  const exercises: PlannedExercise[] = chosen.map((c, i) => {
    const { ex, f, slot } = c;
    let rx = prescribe(slot.role, f, level, request.intent, reduced);
    if (formatted) rx = formatRx(request.format, f, rx);
    let rpe = Math.min(rx.rpe, effortCap);
    if (c.gripManaged) rpe = Math.max(5, rpe - 1);
    const reps = firstRep(rx.reps);
    const weight = f.timed || /sec/.test(rx.reps) ? null : suggestWeight(ex.name, ex.equipment, ctx.benchmarks, reps, rpe);
    const cueParts = [`RPE ${rpe}`, rx.rest];
    if (c.gripManaged) cueParts.push("your grip is already working, so keep this one moderate");
    if (weight) cueParts.push("weight is a starting estimate");
    const dropset = level === "advanced" && stage === null && !formatted && i === lastComplementIndex && !f.compound && !f.spineLoaded && !f.balance && request.intent !== "conditioning";
    if (dropset) cueParts.push("last set: drop the weight about 25% twice and keep going");
    let supersetGroup: string | null = null;
    if (pairing) {
      if (slot.role === "main") supersetGroup = String.fromCharCode(65 + chosen.slice(0, i).filter((x) => x.slot.role === "main").length);
      else if (slot.role === "complement" && slot.pairWith !== undefined) {
        const mainIdx = chosen.findIndex((x) => x.slot === layout[slot.pairWith!]);
        if (mainIdx >= 0) supersetGroup = String.fromCharCode(65 + chosen.slice(0, mainIdx).filter((x) => x.slot.role === "main").length);
      }
    }
    return {
      exerciseId: ex.id,
      name: ex.name,
      bodyPart: ex.bodyPart,
      bucket: f.bucket,
      role: slot.role === "accessory" ? "complement" : slot.role,
      sets: rx.sets,
      reps: rx.reps,
      weight,
      setType: dropset ? "dropset" : "standard",
      supersetGroup,
      cue: cueParts.join(". "),
    };
  });

  // 5. Explain.
  const short = exercises.length < Math.min(layout.length, totalSlots) || exercises.length < MIN_SLOTS;
  const notes = explain({ request, level, stage, injuries, skipped, exercises, chosen, trainedYesterday, reduced, lowEnergy, effortCap, formatted, short });
  return { exercises, notes, short };
}

function formatRx(format: SessionFormat, f: ExerciseFlags, rx: Rx): Rx {
  switch (format) {
    case "tabata":
      return { sets: 1, reps: "20 sec on, 10 sec off", rpe: 8, rest: "8 rounds as a block" };
    case "emom":
      return { sets: 1, reps: f.timed ? "40 sec" : "10 reps", rpe: 7, rest: "start a new round every minute" };
    case "amrap":
      return { sets: 1, reps: f.timed ? "40 sec" : "10 reps", rpe: 7, rest: "as many rounds as you can" };
    case "chipper":
      return { sets: 1, reps: f.timed ? "60 sec" : "20 reps", rpe: 7, rest: "work through the list once" };
    default:
      return { sets: 3, reps: f.timed ? "40 sec" : "12 reps", rpe: rx.rpe, rest: "20 sec to move to the next station" };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Explanation.
// ---------------------------------------------------------------------------------------------------------------------------------------------

const INTENT_LABEL: Record<Intent, string> = { strength: "strength", tempo: "high-tempo", sport: "sport-focused", conditioning: "conditioning" };
const FORMAT_LABEL: Record<SessionFormat, string> = { standard: "standard", circuit: "circuit", amrap: "AMRAP", emom: "EMOM", tabata: "Tabata", chipper: "chipper" };
const AREA_LABEL: Record<InjuryArea, string> = { ankle: "ankle", knee: "knee", hip: "hip", lower_back: "lower back", shoulder: "shoulder", elbow: "elbow", wrist: "wrist", neck: "neck" };
const STAGE_LABEL: Record<PregnancyStage, string> = { first: "first trimester", second: "second trimester", third: "third trimester" };

function explain(a: {
  request: SessionRequest;
  level: string;
  stage: PregnancyStage | null;
  injuries: InjuryArea[];
  skipped: { pregnancy: Set<string>; injury: Set<InjuryArea> };
  exercises: PlannedExercise[];
  chosen: { ex: LibraryExercise; f: ExerciseFlags; slot: Slot; gripManaged: boolean }[];
  trainedYesterday: Set<MovementBucket>;
  reduced: boolean;
  lowEnergy: boolean;
  effortCap: number;
  formatted: boolean;
  short: boolean;
}): string[] {
  const { request, exercises } = a;
  const notes: string[] = [];
  const split = request.split === "fullBody" ? "full-body" : request.split === "upper" ? "upper-body" : "lower-body";
  if (exercises.length === 0) {
    notes.push("No exercises fit your equipment, level and the limits you set. Try adding equipment, or loosening one of the limits.");
    return notes;
  }
  if (a.formatted) {
    notes.push(`A ${FORMAT_LABEL[request.format]} ${split} session with ${exercises.length} simple movements, picked to be low on setup and technique. Start it as ${FORMAT_LABEL[request.format]} on the workout screen.`);
  } else {
    notes.push(`A ${split}, ${INTENT_LABEL[request.intent]} session for the ${a.level} level: ${exercises.length} exercises, about ${request.timeMinutes} minutes.`);
    const firstMain = a.chosen[0];
    const firstPartner = a.chosen[1];
    if (firstMain && firstPartner && firstPartner.slot.role === "complement") {
      notes.push(
        `Each hard lift is followed by a lighter exercise for the opposite movement (${firstMain.ex.name}, then ${firstPartner.ex.name}), so your nervous system and the working muscles get a breather before the next hard one.`,
      );
    }
    if (a.chosen.some((c) => c.slot.role === "finisher" && c.slot.bucket === "tempo")) {
      notes.push("A cardio-style exercise follows a pair to lift your heart rate, and a core exercise follows it when the previous exercises were fast.");
    }
  }
  if (a.trainedYesterday.size > 0) {
    const names = [...a.trainedYesterday].map((b) => BUCKET_LABEL[b] ?? b).join(" and ");
    notes.push(`You trained ${names} work yesterday, so there is no heavy lift from that group today. It only appears as a light exercise where it fits.`);
  }
  if (a.stage) {
    const left = [...a.skipped.pregnancy];
    notes.push(
      `Pregnancy (${STAGE_LABEL[a.stage]}): exercises are limited to your level or below, effort is capped at about ${a.effortCap} out of 10 (you should be able to hold a conversation), and ${left.length > 0 ? `exercises were left out that involve ${left.join(", ")}` : "nothing needed to be left out"}. This is general guidance, not medical advice: follow what your midwife or GP has told you, and stop if you feel dizzy, short of breath, or have pain or bleeding.`,
    );
  }
  if (a.injuries.length > 0) {
    const areas = a.injuries.map((i) => AREA_LABEL[i]).join(" and ");
    notes.push(`Exercises that load your ${areas} were left out. If it hurts during an exercise, stop. A physio or doctor can tell you what is safe to add back.`);
  }
  if (a.reduced || a.lowEnergy) notes.push("It is a lighter day (low readiness or energy), so there are fewer sets and a lower effort target.");
  if (a.chosen.some((c) => c.gripManaged)) notes.push("Two exercises in a row work your grip, so the second is kept moderate to avoid wearing your grip out for later lifts.");
  const anyWeight = exercises.some((e) => e.weight);
  notes.push(
    anyWeight
      ? "Weights marked with ~ are starting estimates from the best lifts you entered. Always log what you actually lift."
      : "Choose weights by effort: RPE 7 means you could do about three more reps.",
  );
  if (request.note && request.note.trim()) notes.push(`Your note: "${request.note.trim().slice(0, 200)}".`);
  if (a.short) notes.push("Your equipment, level and limits left fewer exercises than that time would normally use, so this session is shorter.");
  return notes;
}
