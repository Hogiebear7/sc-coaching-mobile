// The "Sore or injured?" screen (owner decision 2026-11-24: scaled right back). It gives NO advice. It does two things only:
//   1. a short checklist of danger signs: if any is ticked, it says to get checked and does not offer a workout;
//   2. otherwise it tells the workout generator which areas to work around for a few days, and says plainly that it cannot judge whether the member should train.
// The AI is not involved at all. Pure helpers, unit tested.

import { INJURY_AREAS, type InjuryArea } from "@/lib/session-engine/types";

export const AREA_LABELS: Record<InjuryArea, string> = {
  ankle: "Ankle",
  knee: "Knee",
  hip: "Hip",
  lower_back: "Lower back",
  shoulder: "Shoulder",
  elbow: "Elbow",
  wrist: "Wrist",
  neck: "Neck",
};

/** How long a "work around this area" note keeps shaping the workout generator before it lapses on its own. */
export const SORE_TTL_DAYS = 3;

export type DangerLevel = "emergency" | "urgent" | "pregnancy";

export interface DangerSign {
  id: string;
  label: string;
  level: DangerLevel;
}

// The same kinds of red flags the server's fixed check looks for in the coach chat (gym-app lib/injury-triage.ts). Wording of the replies below matches it.
export const DANGER_SIGNS: DangerSign[] = [
  { id: "chest", label: "Chest pain, or trouble breathing", level: "emergency" },
  { id: "head", label: "A head injury, fainting or confusion", level: "emergency" },
  { id: "groin", label: "Numbness around the groin, or lost control of bladder or bowel", level: "emergency" },
  { id: "deformed", label: "A bone that looks out of place or bleeding that won't stop", level: "emergency" },
  { id: "weight", label: "I can't put weight on it", level: "urgent" },
  { id: "accident", label: "A fall or accident", level: "urgent" },
  { id: "numb", label: "New numbness or tingling in an arm, hand, leg or foot", level: "urgent" },
  { id: "swollen", label: "Swollen, hot or red, especially a calf", level: "urgent" },
  { id: "pop", label: "I felt or heard a pop, snap or tear, or a joint has locked", level: "urgent" },
  { id: "severe", label: "Severe or unbearable pain", level: "urgent" },
  { id: "fever", label: "A fever or I feel unwell", level: "urgent" },
  { id: "pregnancy", label: "I'm pregnant and have bleeding or severe tummy pain", level: "pregnancy" },
];

const SIGN_OFF = "This app can't assess this and isn't medical advice.";

export const DANGER_REPLIES: Record<DangerLevel, string> = {
  emergency: `What you've ticked can sometimes be serious. Please call 112 or 999 now, or go to your nearest emergency department. Please don't train until you've been seen. ${SIGN_OFF}`,
  urgent: `What you've ticked is worth getting checked soon. Please get seen today: go to an urgent care or injury unit or an emergency department, or phone your GP and tell them it's new or getting worse. If it gets worse, or you feel unwell, call 112 or 999. Please don't train the affected area until you've been seen. ${SIGN_OFF}`,
  pregnancy: `What you've ticked in pregnancy needs checking straight away. Please contact your maternity unit or GP now. If you're bleeding heavily, in severe pain, or feel very unwell, call 112 or 999 or go to your nearest emergency department. Please don't train until you've been seen. ${SIGN_OFF}`,
};

const ORDER: DangerLevel[] = ["emergency", "pregnancy", "urgent"];

/** The most serious level among the ticked danger signs, or null when none are ticked. */
export function dangerLevel(ticked: string[]): DangerLevel | null {
  const levels = DANGER_SIGNS.filter((s) => ticked.includes(s.id)).map((s) => s.level);
  return ORDER.find((l) => levels.includes(l)) ?? null;
}

export interface IntakeState {
  areas: InjuryArea[];
  dangers: string[];
}

export type IntakeOutcome =
  | { kind: "incomplete" }
  | { kind: "danger"; level: DangerLevel; reply: string }
  | { kind: "ok"; areas: InjuryArea[]; message: string };

/** What the screen shows after "Continue". Never says it is safe to train, never says what it might be, never gives a timeline. */
export function assessIntake(i: IntakeState): IntakeOutcome {
  const level = dangerLevel(i.dangers);
  if (level) return { kind: "danger", level, reply: DANGER_REPLIES[level] };
  if (i.areas.length === 0) return { kind: "incomplete" };
  const where = i.areas.map((a) => AREA_LABELS[a].toLowerCase()).join(", ");
  return {
    kind: "ok",
    areas: i.areas,
    message: `This can't tell you whether you should train. If you choose to, the workout generator will leave out exercises that load your ${where} for the next ${SORE_TTL_DAYS} days. Stop anything that hurts. If it's getting worse or not settling, see a physio or GP.`,
  };
}

export interface SoreNote {
  areas: InjuryArea[];
  /** ISO time the note was saved. */
  savedAt: string;
}

/** The areas still in effect: a note lapses after SORE_TTL_DAYS. Bad data gives nothing. */
export function activeSoreAreas(note: SoreNote | null, now: Date): InjuryArea[] {
  if (!note || !Array.isArray(note.areas)) return [];
  const saved = new Date(note.savedAt).getTime();
  if (Number.isNaN(saved) || now.getTime() - saved > SORE_TTL_DAYS * 24 * 60 * 60 * 1000 || saved > now.getTime() + 60_000) return [];
  return note.areas.filter((a): a is InjuryArea => (INJURY_AREAS as readonly string[]).includes(a));
}

/** Areas from rehab exercises that are switched on. Anything that is not a known area is ignored. */
export function rehabAreas(targets: { kind: string; active: boolean; area?: string }[]): InjuryArea[] {
  const out = new Set<InjuryArea>();
  for (const t of targets) {
    if (t.kind === "rehab" && t.active && t.area && (INJURY_AREAS as readonly string[]).includes(t.area)) out.add(t.area as InjuryArea);
  }
  return [...out];
}

/** The areas the generator works around: the ones the member ticked, plus the ones added for them. Order is stable and nothing repeats. */
export function mergeAreas(...lists: InjuryArea[][]): InjuryArea[] {
  return INJURY_AREAS.filter((a) => lists.some((l) => l.includes(a)));
}
