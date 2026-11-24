// Starting-weight estimates from the benchmarks a member chose to enter (5-rep bests). These are rough: the ratios between lifts differ from person to
// person, so the result is shown as a starting point ("~60 kg") and the member always logs what they actually lifted. With no benchmark the engine
// gives an effort target (RPE) instead of a weight.

import type { Benchmarks } from "./types";

/** Epley: a 5-rep best to a one-rep max. */
export function oneRepMaxFromFive(fiveRmKg: number): number {
  return fiveRmKg * (1 + 5 / 30);
}

/** The weight for `reps` at a given RPE (10 = nothing left, 8 = two in reserve), from a one-rep max. */
export function weightForReps(oneRmKg: number, reps: number, rpe: number): number {
  const inReserve = Math.max(0, 10 - rpe);
  return oneRmKg / (1 + (reps + inReserve) / 30);
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

interface Family {
  /** Which benchmark, and what fraction of it this lift is, for the whole load (or per hand when `perHand`). */
  ref: keyof Benchmarks;
  ratio: number;
  perHand?: boolean;
}

function familyFor(name: string, equipment: string): Family | null {
  const n = name.toLowerCase();
  const barbell = /barbell|olympic|trap bar|smith/.test(equipment);
  const handheld = /dumbbell|kettlebell/.test(equipment);
  if (/goblet/.test(n)) return { ref: "squat5rmKg", ratio: 0.35 };
  if (/front squat/.test(n) && barbell) return { ref: "squat5rmKg", ratio: 0.8 };
  if (/squat/.test(n) && barbell && !/split|lunge|hack|overhead|single|pistol|zercher/.test(n)) return { ref: "squat5rmKg", ratio: 1 };
  if (/romanian|stiff/.test(n) && barbell) return { ref: "rdl5rmKg", ratio: 1 };
  if (/romanian|stiff|deadlift/.test(n) && handheld && !/single|one/.test(n)) return { ref: "rdl5rmKg", ratio: 0.3, perHand: true };
  if (/deadlift/.test(n) && barbell && !/single|sumo deficit|snatch/.test(n)) return { ref: "deadlift5rmKg", ratio: 1 };
  if (/bench press/.test(n) && barbell) return { ref: "bench5rmKg", ratio: /incline|decline/.test(n) ? 0.8 : 1 };
  if (/bench press|chest press/.test(n) && handheld) return { ref: "bench5rmKg", ratio: 0.38, perHand: true };
  if (/overhead press|shoulder press|military/.test(n) && barbell) return { ref: "bench5rmKg", ratio: 0.6 };
  if (/shoulder press|overhead press/.test(n) && handheld) return { ref: "bench5rmKg", ratio: 0.22, perHand: true };
  if (/\brow\b/.test(n) && barbell) return { ref: "bench5rmKg", ratio: 0.7 };
  if (/\brow\b/.test(n) && handheld) return { ref: "bench5rmKg", ratio: 0.3, perHand: true };
  return null;
}

export function suggestWeight(name: string, equipment: string | null, benchmarks: Benchmarks | null | undefined, reps: number, rpe: number): string | null {
  if (!benchmarks) return null;
  const family = familyFor(name, (equipment ?? "").toLowerCase());
  if (!family) return null;
  const five = benchmarks[family.ref];
  if (!five || five <= 0) return null;
  const raw = weightForReps(oneRepMaxFromFive(five) * family.ratio, reps, rpe);
  const step = family.perHand ? 2 : 2.5;
  const rounded = Math.max(step, roundTo(raw, step));
  return family.perHand ? `~${rounded} kg each` : `~${rounded} kg`;
}
