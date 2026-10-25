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
};

const DARK_VALUE: ThemeContextValue = {
  scheme: "dark",
  colors: DarkPalette,
  data: DataColor,
  legacy: Color,
  preference: "dark",
  setPreference: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(DARK_VALUE);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "system" || v === "light" || v === "dark") setPreferenceState(v);
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = resolveScheme(preference, system, LIGHT_MODE_AVAILABLE);
    Object.assign(LiveColor, scheme === "light" ? ColorLight : Color);
    return {
      scheme,
      colors: scheme === "light" ? LightPalette : DarkPalette,
      data: scheme === "light" ? DataColorLight : DataColor,
      legacy: scheme === "light" ? ColorLight : Color,
      preference,
      setPreference,
    };
  }, [preference, system, setPreference]);

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
