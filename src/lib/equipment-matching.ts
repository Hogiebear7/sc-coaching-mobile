import type { EquipmentItem } from "@/lib/queries/gym-profiles";

// Mirrors lib/equipment-matching.ts in the main repo — same V1 rule: an
// exercise's `equipment` is a single free-text vendor string (or null for
// bodyweight), matched case-insensitively against a catalog item's label
// or aliases. See that file for the full rationale.

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function equipmentSlugMatchesVendorString(item: EquipmentItem, vendorEquipment: string): boolean {
  const target = normalize(vendorEquipment);
  return normalize(item.label) === target || item.aliases.some((a) => normalize(a) === target);
}

// No equipment listed = always includable (bodyweight). Empty slugs list =
// nothing selected yet, so nothing is filtered out either.
export function exerciseMatchesEquipmentSlugs(
  vendorEquipment: string | null,
  equipmentSlugs: string[],
  catalog: EquipmentItem[]
): boolean {
  if (!vendorEquipment || !vendorEquipment.trim()) return true;
  if (equipmentSlugs.length === 0) return true;
  const selected = catalog.filter((e) => equipmentSlugs.includes(e.slug));
  return selected.some((item) => equipmentSlugMatchesVendorString(item, vendorEquipment));
}
