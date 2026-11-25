import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import {
  Color,
  ColorLight,
  DarkPalette,
  DataColor,
  DataColorLight,
  LightPalette,
  LiveColor,
  type AppPalette,
  type DataPalette,
  type LegacyPalette,
} from "@/constants/theme";
import { ACCENT_STORAGE_KEY, applyAccent, isAccentVariant, type AccentVariant } from "@/lib/accent";
import { accentForScheme, withBrand } from "@/lib/gym-accent";
import { useGymBranding } from "@/lib/gym-branding";
import { SEASON_PREVIEW_ENABLED } from "@/lib/season";
import { resolveScheme, type ColorScheme, type ThemePreference } from "@/lib/theme-scheme";

// App theme (App v2). Components read colours from here instead of importing
// a fixed palette, so a light theme is a palette swap rather than a rewrite.
//
// LIGHT_MODE_AVAILABLE gates the Settings picker; every screen now reads
// the palette, so it is on. Members start on dark (the S&C look) and opt in
// to Light or System from Settings → Preferences → Appearance.
export const LIGHT_MODE_AVAILABLE = true;

export type { ColorScheme, ThemePreference } from "@/lib/theme-scheme";

const STORAGE_KEY = "sc.themePreference";

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: AppPalette;
  data: DataPalette;
  legacy: LegacyPalette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** Test builds only: which colour accent is previewed (lib/accent.ts). "none" is the normal look. */
  accentVariant: AccentVariant;
  setAccentVariant: (v: AccentVariant) => void;
};

const DARK_VALUE: ThemeContextValue = {
  scheme: "dark",
  colors: DarkPalette,
  data: DataColor,
  legacy: Color,
  preference: "dark",
  setPreference: () => {},
  accentVariant: "none",
  setAccentVariant: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(DARK_VALUE);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // A tenant gym's own colour (the server's branding), or null for S&C and any gym that set none: it replaces the gold accent for that gym's people.
  const branding = useGymBranding();
  const gymColour = branding.custom ? branding.accentColor : null;
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [accentVariant, setAccentState] = useState<AccentVariant>("none");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "system" || v === "light" || v === "dark") setPreferenceState(v);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!SEASON_PREVIEW_ENABLED) return;
    AsyncStorage.getItem(ACCENT_STORAGE_KEY)
      .then((v) => {
        if (isAccentVariant(v)) setAccentState(v);
      })
      .catch(() => {});
  }, []);

  const setAccentVariant = useCallback((v: AccentVariant) => {
    setAccentState(v);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, v).catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = resolveScheme(preference, system, LIGHT_MODE_AVAILABLE);
    const legacy = withBrand(scheme === "light" ? ColorLight : Color, accentForScheme(gymColour, scheme), scheme);
    Object.assign(LiveColor, legacy);
    return {
      scheme,
      colors: applyAccent(scheme === "light" ? LightPalette : DarkPalette, "gold", scheme, gymColour),
      data: scheme === "light" ? DataColorLight : DataColor,
      legacy,
      preference,
      setPreference,
      accentVariant,
      setAccentVariant,
    };
  }, [preference, system, setPreference, accentVariant, setAccentVariant, gymColour]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Themed StyleSheet factory: `const useStyles = makeStyles((c) => ({ ... }))`
// at module level, then `const styles = useStyles()` in the component. The
// sheet is rebuilt only when the palette changes.
export function makeStyles<T>(factory: (c: AppPalette, d: DataPalette, legacy: LegacyPalette) => T): () => T {
  const cache = new Map<AppPalette, T>();
  return function useStyles() {
    const { colors, data, legacy } = useAppTheme();
    let sheet = cache.get(colors);
    if (!sheet) {
      sheet = factory(colors, data, legacy);
      cache.set(colors, sheet);
    }
    return sheet;
  };
}

// Legacy-token twins of the two helpers above, for screens written against
// the original `Color` names (bg0, surface1, gold…). The codemod that
// converted them names the factory parameter `Color`, so stylesheet bodies
// read exactly as before.
export function useLegacyColors(): LegacyPalette {
  return useAppTheme().legacy;
}

export function makeLegacyStyles<T>(factory: (c: LegacyPalette) => T): () => T {
  const cache = new Map<LegacyPalette, T>();
  return function useStyles() {
    const legacy = useLegacyColors();
    let sheet = cache.get(legacy);
    if (!sheet) {
      sheet = factory(legacy);
      cache.set(legacy, sheet);
    }
    return sheet;
  };
}
