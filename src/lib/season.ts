import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// The seasonal look (gym-app lib/seasons.ts, GET /api/season). The server decides which season it is from the Irish date and can switch every effect off, so a
// new season needs no new app build: the app just draws whatever falling pieces and extras the server names. Only Christmas has artwork so far.
export type Particle = "snow" | "hearts" | "shamrocks" | "eggs" | "sun" | "leaves" | "cobwebs";

export interface SeasonInfo {
  key: string;
  label: string;
  particle: Particle;
  pile: boolean;
  hat: boolean;
  ready: boolean;
}

export interface SeasonNow {
  season: SeasonInfo | null;
  overlay: { key: "new-year"; fireworks: boolean; message: string } | null;
  /** The splash and banner message from the server (Christmas has none until 18 December). Absent from older servers. */
  greeting?: string | null;
  /** Changes when the artwork files on the website change, so a phone downloads the new pictures. Absent from older servers. */
  artVersion?: number;
  date: string;
}

const EFFECTS_KEY = "season-effects-v1"; // "off" when the member has switched seasonal effects off
const PREVIEW_KEY = "season-preview-v1"; // test builds only: "christmas" or "new-year" to see a season on any day

/** The seasons a test build can preview on any day (Settings, Appearance). Real dates and which ones are switched on come from the server. */
export const PREVIEW_CHOICES: { key: string | null; label: string }[] = [
  { key: null, label: "Today" },
  { key: "christmas", label: "Christmas" },
  { key: "new-year", label: "New Year" },
  { key: "valentines", label: "Valentine's" },
  { key: "stpatricks", label: "St Patrick's" },
  { key: "easter", label: "Easter" },
  { key: "halloween", label: "Halloween" },
];

const PREVIEW_INFO: Record<string, Omit<SeasonInfo, "key">> = {
  christmas: { label: "Christmas", particle: "snow", pile: true, hat: true, ready: true },
  valentines: { label: "Valentine's", particle: "hearts", pile: false, hat: false, ready: true },
  stpatricks: { label: "St Patrick's", particle: "shamrocks", pile: false, hat: false, ready: true },
  easter: { label: "Easter", particle: "eggs", pile: false, hat: false, ready: true },
  halloween: { label: "Halloween", particle: "cobwebs", pile: false, hat: false, ready: true },
};

/** What the splash screen says for each season. */
export const SPLASH_MESSAGES: Record<string, string> = {
  christmas: "Happy Christmas",
  valentines: "Happy Valentine's Day",
  stpatricks: "Happy St Patrick's Day",
  easter: "Happy Easter",
  halloween: "Happy Halloween",
};

/** Test builds (built with EXPO_PUBLIC_SEASON_PREVIEW=true) show a "Preview season" picker in Settings. Store builds never do. */
export const SEASON_PREVIEW_ENABLED = process.env.EXPO_PUBLIC_SEASON_PREVIEW === "true";

interface SeasonPrefs {
  effectsOn: boolean;
  preview: string | null;
}

async function readPrefs(): Promise<SeasonPrefs> {
  try {
    const [effects, preview] = await Promise.all([AsyncStorage.getItem(EFFECTS_KEY), SEASON_PREVIEW_ENABLED ? AsyncStorage.getItem(PREVIEW_KEY) : Promise.resolve(null)]);
    return { effectsOn: effects !== "off", preview: preview || null };
  } catch {
    return { effectsOn: true, preview: null };
  }
}

export function useSeasonPrefs() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ["season-prefs"], queryFn: readPrefs, staleTime: Infinity });
  const setEffectsOn = useMutation({
    mutationFn: async (on: boolean) => {
      await AsyncStorage.setItem(EFFECTS_KEY, on ? "on" : "off").catch(() => undefined);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["season-prefs"] }),
  });
  const setPreview = useMutation({
    mutationFn: async (value: string | null) => {
      if (value) await AsyncStorage.setItem(PREVIEW_KEY, value).catch(() => undefined);
      else await AsyncStorage.removeItem(PREVIEW_KEY).catch(() => undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["season-prefs"] });
      qc.invalidateQueries({ queryKey: ["season"] });
    },
  });
  return { effectsOn: prefs.data?.effectsOn ?? true, preview: prefs.data?.preview ?? null, setEffectsOn, setPreview };
}

/**
 * The Christmas window worked out on the phone (1 Dec to 6 Jan, New Year on 1 and 2 Jan, Irish date). Only a stand-in for the first moments, such as the
 * splash screen, before the server has answered; the server stays in charge (it can switch every effect off).
 */
export function localSeason(now: Date = new Date()): SeasonNow {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  const md = parts[1] * 100 + parts[2];
  const christmas = md >= 1201 || md <= 106;
  const newYear = md === 101 || md === 102;
  return {
    season: christmas ? { key: "christmas", label: "Christmas", particle: "snow", pile: true, hat: true, ready: true } : null,
    overlay: christmas && newYear ? { key: "new-year", fireworks: true, message: "Happy New Year from S&C Performance Coaching" } : null,
    greeting: christmas && md >= 1218 ? "Happy Christmas" : null,
    date: "local",
  };
}

/** What season the app should look like right now: null when it's the plain brand look, the member has switched effects off, or the server can't be reached. */
export function useSeason(): { season: SeasonInfo | null; overlay: SeasonNow["overlay"]; greeting: string | null; artVersion: number } {
  const { effectsOn, preview } = useSeasonPrefs();
  const q = useQuery({
    queryKey: ["season", preview],
    queryFn: async () => {
      // Test builds: a previewed season is built here, so it works before (or without) the server answering.
      if (preview && (preview === "new-year" || preview in PREVIEW_INFO)) {
        const key = preview === "new-year" ? "christmas" : preview;
        return {
          season: { key, ...PREVIEW_INFO[key] },
          overlay: preview === "new-year" ? { key: "new-year" as const, fireworks: true, message: "Happy New Year from S&C Performance Coaching" } : null,
          greeting: preview === "new-year" ? null : SPLASH_MESSAGES[key] ?? null,
          date: "preview",
        } satisfies SeasonNow;
      }
      const force = preview;
      const res = await apiFetch<{ success: true; data: SeasonNow }>(force ? `/api/season?force=${encodeURIComponent(force)}` : "/api/season");
      const data = res.data;
      // New Year preview: the server doesn't fake the date, so add the overlay here.
      if (preview === "new-year" && data.season) {
        return { ...data, overlay: { key: "new-year" as const, fireworks: true, message: "Happy New Year from S&C Performance Coaching" } };
      }
      return data;
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
    placeholderData: preview ? undefined : localSeason(),
  });
  const artVersion = q.data?.artVersion ?? 1;
  if (!effectsOn || !q.data) return { season: null, overlay: null, greeting: null, artVersion };
  return { season: q.data.season, overlay: q.data.overlay, greeting: q.data.greeting ?? null, artVersion };
}
