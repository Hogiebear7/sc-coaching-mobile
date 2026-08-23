import type { RecipeIngredient } from "@/lib/queries/recipes";

// Best-effort "2 cups spinach" → {quantity: 2, unit: "cups", name: "spinach"}
// parsing, shared between saving a recipe (from What Can I Make?'s
// AI-generated ingredient strings) and typing a shopping list item directly.
// Neither source is structured input, so this is deliberately conservative:
// no match just means quantity/unit stay null and the full string is kept
// as displayText regardless — never a reason to lose or mangle what the
// member actually sees.
const QUANTITY_UNIT_RE =
  /^(\d+(?:\.\d+)?|\d+\/\d+)\s*(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|g|grams?|kg|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lbs?|pounds?|cans?|cloves?|slices?|pieces?|pinch(?:es)?|x)?\s+(.+)$/i;

function parseQuantity(raw: string): number | null {
  if (raw.includes("/")) {
    const [n, d] = raw.split("/").map(Number);
    return d ? Math.round((n / d) * 100) / 100 : null;
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseIngredientText(text: string): RecipeIngredient {
  const trimmed = text.trim();
  const match = trimmed.match(QUANTITY_UNIT_RE);
  if (match) {
    const [, qtyRaw, unit, name] = match;
    return {
      displayText: trimmed,
      normalizedName: name.trim() || null,
      quantity: parseQuantity(qtyRaw),
      unit: unit ? unit.toLowerCase() : null,
    };
  }
  return { displayText: trimmed, normalizedName: null, quantity: null, unit: null };
}
