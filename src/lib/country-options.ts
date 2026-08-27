// Mirrors lib/profile-options.ts's COUNTRY_OPTIONS in the main repo — every
// value here must have a matching entry in the main repo's
// lib/food-catalog.ts OFF_COUNTRY_TAG_TO_ALPHA2 map or the search ranking
// boost can never fire for that country's Open-Food-Facts-sourced foods.
export const COUNTRIES = [
  { label: "Ireland", value: "IE" },
  { label: "United Kingdom", value: "GB" },
  { label: "United States", value: "US" },
  { label: "Canada", value: "CA" },
  { label: "Australia", value: "AU" },
  { label: "New Zealand", value: "NZ" },
  { label: "France", value: "FR" },
  { label: "Germany", value: "DE" },
  { label: "Spain", value: "ES" },
  { label: "Italy", value: "IT" },
  { label: "Netherlands", value: "NL" },
  { label: "Belgium", value: "BE" },
  { label: "Portugal", value: "PT" },
  { label: "Switzerland", value: "CH" },
  { label: "Austria", value: "AT" },
  { label: "Sweden", value: "SE" },
  { label: "Norway", value: "NO" },
  { label: "Denmark", value: "DK" },
  { label: "Finland", value: "FI" },
  { label: "Poland", value: "PL" },
] as const;
