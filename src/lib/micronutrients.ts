// Vitamins, minerals and omega-3 as the server sends a day's totals (data.micros on the diary response). Unknown is never zero: a nutrient nobody listed shows "No data", and a
// total that is missing some foods is marked "at least". Pure helpers, unit tested.

export type MicroGroup = "mineral" | "vitamin" | "fat";

export interface MicroTotalView {
  key: string;
  label: string;
  unit: string;
  group: MicroGroup;
  total: number;
  listedBy: number;
  entryCount: number;
  atLeast: boolean;
  /** "2 of 3 foods list this". */
  coverage: string;
  /** "at least 3.5 mg" or "No data". */
  display: string;
}

export const MICRO_GROUP_LABEL: Record<MicroGroup, string> = { mineral: "Minerals", vitamin: "Vitamins", fat: "Fats" };
const GROUP_ORDER: MicroGroup[] = ["vitamin", "mineral", "fat"];

/** A food entry with the vitamins and minerals it listed (only the known ones are present). */
export interface EntryWithMicros {
  id: string;
  name: string;
  micros?: Partial<Record<string, number>> | null;
}

export function anyMicrosKnown(totals: readonly MicroTotalView[] | null | undefined): boolean {
  return !!totals && totals.some((t) => t.listedBy > 0);
}

/** The nutrients grouped for the explorer screen (vitamins, minerals, fats), each group in the server's order. Empty groups are left out. */
export function groupMicros(totals: readonly MicroTotalView[] | null | undefined): { group: MicroGroup; label: string; items: MicroTotalView[] }[] {
  if (!totals) return [];
  return GROUP_ORDER.map((group) => ({ group, label: MICRO_GROUP_LABEL[group], items: totals.filter((t) => t.group === group) })).filter((g) => g.items.length > 0);
}

/** The nutrients with data, biggest coverage first then in the server's order, for the short list on the Nutrition tab. */
export function topKnownMicros(totals: readonly MicroTotalView[] | null | undefined, limit = 4): MicroTotalView[] {
  if (!totals) return [];
  return totals
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.listedBy > 0)
    .sort((a, b) => b.t.listedBy - a.t.listedBy || a.i - b.i)
    .slice(0, limit)
    .map(({ t }) => t);
}

/** Which logged foods contributed most of one nutrient today (the "foods that contributed" list in a nutrient's focus view). Only foods that list it are included. */
export function contributors(entries: readonly EntryWithMicros[] | null | undefined, key: string, limit = 5): { name: string; value: number }[] {
  const byName = new Map<string, number>();
  for (const e of entries ?? []) {
    const v = e.micros?.[key];
    if (typeof v === "number" && v > 0) byName.set(e.name, (byName.get(e.name) ?? 0) + v);
  }
  return [...byName.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** "12.5" or "190": at most two decimals, no trailing zeros. */
export function formatAmount(value: number, unit: string): string {
  const r = Math.round(value * 100) / 100;
  return `${Number.isInteger(r) ? r : String(r)} ${unit}`;
}
