// Drinks a member can log on the Hydration card. The server keeps one number
// for the day (millilitres of water-equivalent), so a drink is converted to
// that before it is sent: 250 ml of juice that counts as 90% adds 225 ml.
//
// The shares follow the one large controlled study of this (Maughan et al.,
// Am J Clin Nutr 2016: 72 fasted men, 1 L of each drink, urine collected for
// 4 hours). Tea, coffee, cola, juice, sports drink and sparkling water were
// not different from still water, so each counts as roughly the water it
// contains (cola and juice are about 89% water, a sports drink 96%). Milk
// kept more water in the body than water did, but it is capped at 100% to stay
// simple. Coffee is trimmed a little because the study's coffee was weak per
// litre (about 212 mg of caffeine) and a large strong one can pass the
// roughly 300 mg where caffeine starts to increase urine output. Alcohol is
// left out on purpose: it is not something to count towards a goal.

export type DrinkId = "water" | "tea" | "coffee" | "milk" | "juice" | "sports" | "soda";

export interface DrinkType {
  id: DrinkId;
  label: string;
  /** Share of the volume that counts towards the daily goal, 0-1. */
  share: number;
  /** Chip dot colour. */
  color: string;
}

export const DRINK_TYPES: readonly DrinkType[] = [
  { id: "water", label: "Water", share: 1, color: "#4fd3e3" },
  { id: "tea", label: "Tea", share: 1, color: "#c98a4b" },
  { id: "coffee", label: "Coffee", share: 0.95, color: "#7a4b2a" },
  { id: "milk", label: "Milk", share: 1, color: "#e8e4da" },
  { id: "juice", label: "Juice", share: 0.9, color: "#f0a43a" },
  { id: "sports", label: "Sports drink", share: 0.95, color: "#5ba8f0" },
  { id: "soda", label: "Soda", share: 0.9, color: "#c4504a" },
];

export const DEFAULT_DRINK: DrinkId = "water";

export function findDrink(id: DrinkId): DrinkType {
  return DRINK_TYPES.find((d) => d.id === id) ?? DRINK_TYPES[0];
}

/** Millilitres that count towards the goal for `ml` of the given drink. */
export function waterEquivalentMl(ml: number, id: DrinkId): number {
  if (!Number.isFinite(ml) || ml <= 0) return 0;
  return Math.round(ml * findDrink(id).share);
}

/** A short line saying how a drink counts, or null for a drink that counts in full. */
export function drinkNote(id: DrinkId): string | null {
  const drink = findDrink(id);
  if (drink.share >= 1) return null;
  return `${drink.label} counts as ${Math.round(drink.share * 100)}% towards your goal.`;
}
