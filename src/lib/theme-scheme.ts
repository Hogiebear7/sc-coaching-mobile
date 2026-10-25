// Pure scheme resolution, kept free of React Native imports so it can be
// unit-tested (see lib/theme.tsx for the provider).
export type ThemePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

export function resolveScheme(
  preference: ThemePreference,
  system: ColorScheme | "unspecified" | null | undefined,
  lightAvailable: boolean
): ColorScheme {
  if (!lightAvailable) return "dark";
  if (preference === "system") return system === "light" ? "light" : "dark";
  return preference;
}
