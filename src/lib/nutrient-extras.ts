// Fibre, total sugars, sodium and saturated fat: the extra nutrients carried alongside calories and the three macros. A nutrient is only ever present when it is
// KNOWN for that food. "Not listed" is never turned into zero, so a day's total can honestly say "at least". Pure helpers, unit tested.

export interface NutrientExtras {
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  saturatedFatG?: number;
}

export type ExtraKey = keyof NutrientExtras;

/** The day's totals as the server sends them: what was listed, and how many entries did not list each one. */
export interface ExtraTotals {
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  saturatedFatG: number;
  missing: { fiberG: number; sugarG: number; sodiumMg: number; saturatedFatG: number };
  totalEntries: number;
}

const KEYS: ExtraKey[] = ["fiberG", "sugarG", "sodiumMg", "saturatedFatG"];

/** The known extras from a catalog nutrition block (null = not listed) or a stored entry. Returns null when none are known. */
export function pickExtras(source: { [K in ExtraKey]?: number | null } | null | undefined): NutrientExtras | null {
  if (!source) return null;
  const out: NutrientExtras = {};
  for (const k of KEYS) {
    const v = source[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** "4.2" or "12": at most one decimal, no trailing ".0". */
export function formatGrams(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** "1,240 mg". */
export function formatSodium(mg: number): string {
  return `${String(Math.round(mg)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} mg`;
}

/** Everyday guideline figures shown in small print next to a day's fibre and sodium. General population guidance, not a personal target. */
export const FIBRE_GUIDELINE_G = 25;
export const SODIUM_GUIDELINE_MG = 2000;

export interface ExtraRow {
  key: ExtraKey;
  label: string;
  value: string;
  /** True when some entries did not list this nutrient, so the value is a minimum. */
  atLeast: boolean;
  /** Small print under the value, or null. */
  note: string | null;
}

/** The four rows for the day card. Null when there are no entries (nothing to show). */
export function extraRows(t: ExtraTotals | null | undefined): ExtraRow[] | null {
  if (!t || t.totalEntries === 0) return null;
  const row = (key: ExtraKey, label: string, value: string, note: string | null): ExtraRow => ({
    key,
    label,
    value,
    atLeast: (t.missing[key] ?? 0) > 0,
    note,
  });
  return [
    row("fiberG", "Fibre", `${formatGrams(t.fiberG)} g`, `Guide ${FIBRE_GUIDELINE_G} g+`),
    row("sugarG", "Sugars", `${formatGrams(t.sugarG)} g`, null),
    row("sodiumMg", "Sodium", formatSodium(t.sodiumMg), `Guide under ${formatSodium(SODIUM_GUIDELINE_MG)}`),
    row("saturatedFatG", "Sat. fat", `${formatGrams(t.saturatedFatG)} g`, null),
  ];
}

/** True when no entry at all listed any of the four (an old diary, or only hand-typed foods): the card says so instead of showing four zeros. */
export function noExtrasKnown(t: ExtraTotals): boolean {
  return t.totalEntries > 0 && KEYS.every((k) => t.missing[k] >= t.totalEntries);
}
