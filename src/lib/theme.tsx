import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { DarkPalette, DataColor, DataColorLight, LightPalette, type AppPalette, type DataPalette } from "@/constants/theme";
import { resolveScheme, type ColorScheme, type ThemePreference } from "@/lib/theme-scheme";

// App theme (App v2). Components read colours from here instead of importing
// a fixed palette, so a light theme is a palette swap rather than a rewrite.
//
// LIGHT_MODE_AVAILABLE stays false until every screen reads the palette
// (Phase 2): until then a half-converted app in light mode would show dark
// legacy screens next to light ones, so the resolved scheme is pinned to dark
// and the Settings picker is hidden. The stored preference is still honoured
// the moment the flag flips.
export const LIGHT_MODE_AVAILABLE = false;

export type { ColorScheme, ThemePreference } from "@/lib/theme-scheme";

const STORAGE_KEY = "sc.themePreference";

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: AppPalette;
  data: DataPalette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const DARK_VALUE: ThemeContextValue = {
  scheme: "dark",
  colors: DarkPalette,
  data: DataColor,
  preference: "system",
  setPreference: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(DARK_VALUE);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

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
    return {
      scheme,
      colors: scheme === "light" ? LightPalette : DarkPalette,
      data: scheme === "light" ? DataColorLight : DataColor,
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
export function makeStyles<T>(factory: (c: AppPalette, d: DataPalette) => T): () => T {
  const cache = new Map<AppPalette, T>();
  return function useStyles() {
    const { colors, data } = useAppTheme();
    let sheet = cache.get(colors);
    if (!sheet) {
      sheet = factory(colors, data);
      cache.set(colors, sheet);
    }
    return sheet;
  };
}
