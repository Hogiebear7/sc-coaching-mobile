// Typing a weight for a set. Numbers only (with a decimal point for a half or a quarter kilo), the unit added for you, and a change to one set
// carried down to the sets below it (never the ones above).

export type WeightUnit = "kg" | "lbs";

/** Keeps digits and one decimal point (a comma counts as a point), at most two decimals. Letters and symbols are dropped. */
export function sanitizeWeight(text: string): string {
  const cleaned = text.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned.slice(0, 5);
  const whole = cleaned.slice(0, firstDot).slice(0, 5);
  const decimals = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return `${whole}.${decimals}`;
}

/** "40 kg", "40kg" and "40" all give "40". Anything that is not a plain weight (a band colour, say) is returned as it was. */
export function stripWeightUnit(stored: string): string {
  const t = stored.trim();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(kg|lbs?|kgs)?$/i);
  return m ? m[1] : t;
}

/** "40" becomes "40 kg" (or "40 lbs"). A value that is empty or not a plain number is left as it is. */
export function withWeightUnit(value: string, unit: WeightUnit): string {
  const bare = stripWeightUnit(value);
  return /^\d+(\.\d+)?$/.test(bare) ? `${bare} ${unit}` : value.trim();
}

/** The unit to show, from the member's measurement setting. */
export function weightUnitFor(preferredUnits: string | null | undefined): WeightUnit {
  return preferredUnits === "imperial" ? "lbs" : "kg";
}

/** Sets the weight of one set and of every set after it, and leaves the sets before it alone. */
export function applyWeightFrom<S extends { key: string; weight: string }>(sets: S[], fromKey: string, value: string): S[] {
  const at = sets.findIndex((s) => s.key === fromKey);
  if (at === -1) return sets;
  return sets.map((s, i) => (i >= at ? { ...s, weight: value } : s));
}

/** Puts the unit on every plain-number weight in the list. */
export function normalizeWeights<S extends { weight: string }>(sets: S[], unit: WeightUnit): S[] {
  return sets.map((s) => {
    const next = withWeightUnit(s.weight, unit);
    return next === s.weight ? s : { ...s, weight: next };
  });
}
