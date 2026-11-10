// Drinks a member can log on the Hydration card. The server keeps one number
// for the day (millilitres of water-equivalent), so a drink is converted to
// that before it is sent: 250 ml of coffee that counts as 90% adds 225 ml.
//
// The shares are a deliberate, conservative simplification, not a medical
// claim. In normal amounts tea and coffee hydrate about as well as water; the
// lower figures are there so the total never flatters the member. Alcohol is
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
  { id: "tea", label: "Tea", share: 0.95, color: "#c98a4b" },
  { id: "coffee", label: "Coffee", share: 0.9, color: "#7a4b2a" },
  { id: "milk", label: "Milk", share: 1, color: "#e8e4da" },
  { id: "juice", label: "Juice", share: 0.9, color: "#f0a43a" },
  { id: "sports", label: "Sports drink", share: 1, color: "#5ba8f0" },
  { id: "soda", label: "Soda", share: 0.85, color: "#c4504a" },
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
