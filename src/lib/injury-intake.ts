// The "I'm sore or injured" guided entry in the AI coach chat (safer version of injury guidance, owner plan 2026-11-24). Pure helpers: the options, the message
// the member's choices turn into, and how long a "go easy on this area" note lasts. The AI's replies are limited by rules on the server (no diagnosis, no
// recovery timeline, no AI-written rehab plan), and serious symptoms are caught there by a fixed red-flag check before the AI is ever called.

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

export const STARTED_OPTIONS = [
  { value: "today", label: "Today", phrase: "today" },
  { value: "days", label: "A few days ago", phrase: "a few days ago" },
  { value: "weeks", label: "1 to 2 weeks ago", phrase: "one to two weeks ago" },
  { value: "longer", label: "Longer ago", phrase: "more than two weeks ago" },
] as const;

export const FEEL_OPTIONS = [
  { value: "achy", label: "Achy", phrase: "achy" },
  { value: "sharp", label: "Sharp", phrase: "sharp" },
  { value: "stiff", label: "Stiff", phrase: "stiff" },
  { value: "tight", label: "Tight", phrase: "tight" },
  { value: "pinching", label: "Pinching", phrase: "pinching" },
  { value: "burning", label: "Burning", phrase: "burning" },
] as const;

export type StartedValue = (typeof STARTED_OPTIONS)[number]["value"];
export type FeelValue = (typeof FEEL_OPTIONS)[number]["value"];

export interface InjuryIntake {
  area: InjuryArea | null;
  started: StartedValue | null;
  feel: FeelValue | null;
  note: string;
}

/** How long a "go easy on this area" note keeps shaping the workout generator before it lapses on its own. */
export const SORE_TTL_DAYS = 3;

export function canSubmitIntake(i: InjuryIntake): boolean {
  return i.area !== null;
}

/** The message sent to the coach. Plain description only: the member's choices, no medical wording of ours. */
export function buildInjuryMessage(i: InjuryIntake): string {
  if (!i.area) return "";
  const where = AREA_LABELS[i.area].toLowerCase();
  const started = STARTED_OPTIONS.find((s) => s.value === i.started)?.phrase;
  const feel = FEEL_OPTIONS.find((f) => f.value === i.feel)?.phrase;
  const parts = [`My ${where} is sore.`];
  if (started) parts.push(`It started ${started}.`);
  if (feel) parts.push(`It feels ${feel}.`);
  const note = i.note.trim().slice(0, 200);
  if (note) parts.push(note.endsWith(".") ? note : `${note}.`);
  parts.push("I'd like to keep training if that is sensible. Please keep to general information and tell me when I should get it looked at.");
  return parts.join(" ");
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
