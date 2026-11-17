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
  date: string;
}

const EFFECTS_KEY = "season-effects-v1"; // "off" when the member has switched seasonal effects off
const PREVIEW_KEY = "season-preview-v1"; // test builds only: "christmas" or "new-year" to see a season on any day

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

/** What season the app should look like right now: null when it's the plain brand look, the member has switched effects off, or the server can't be reached. */
export function useSeason(): { season: SeasonInfo | null; overlay: SeasonNow["overlay"] } {
  const { effectsOn, preview } = useSeasonPrefs();
  const q = useQuery({
    queryKey: ["season", preview],
    queryFn: async () => {
      // Test builds: a previewed season is built here, so it works before (or without) the server answering.
      if (preview === "christmas" || preview === "new-year") {
        return {
          season: { key: "christmas", label: "Christmas", particle: "snow" as const, pile: true, hat: true, ready: true },
          overlay: preview === "new-year" ? { key: "new-year" as const, fireworks: true, message: "Happy New Year from S&C Performance Coaching" } : null,
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
  });
  if (!effectsOn || !q.data) return { season: null, overlay: null };
  return { season: q.data.season, overlay: q.data.overlay };
}
