// Mirrors lib/profile-options.ts (DIETARY_PREFERENCE_OPTIONS, ALLERGEN_OPTIONS,
// INTOLERANCE_OPTIONS) in the main repo. Shared by the signup wizard and the
// Profile screen's dietary requirements editor so both stay in sync.
export const DIETARY_PREFERENCES = [
  { label: "No preference", value: "standard" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Pescetarian", value: "pescetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Low carb", value: "low_carb" },
  { label: "Keto", value: "keto" },
  { label: "Paleo", value: "paleo" },
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Intermittent fasting", value: "intermittent_fasting" },
] as const;

export const ALLERGENS = [
  { label: "Peanuts", value: "peanuts" },
  { label: "Tree nuts", value: "tree_nuts" },
  { label: "Shellfish", value: "shellfish" },
  { label: "Molluscs", value: "molluscs" },
  { label: "Fish", value: "fish" },
  { label: "Eggs", value: "eggs" },
  { label: "Milk / dairy", value: "milk" },
  { label: "Soy", value: "soy" },
  { label: "Sesame", value: "sesame" },
  { label: "Gluten", value: "gluten" },
  { label: "Mustard", value: "mustard" },
  { label: "Celery", value: "celery" },
  { label: "Lupin", value: "lupin" },
  { label: "Sulphites", value: "sulphites" },
];

export const INTOLERANCES = [
  { label: "Coeliac", value: "coeliac" },
  { label: "Lactose intolerant", value: "lactose_intolerant" },
  { label: "IBS", value: "ibs" },
  { label: "Histamine intolerance", value: "histamine_intolerant" },
  { label: "Fructose intolerance", value: "fructose_intolerant" },
  { label: "Type 1 diabetes", value: "type_1_diabetes" },
  { label: "Type 2 diabetes", value: "type_2_diabetes" },
  { label: "High blood pressure", value: "high_blood_pressure" },
];

export function optionLabel(options: readonly { label: string; value: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
