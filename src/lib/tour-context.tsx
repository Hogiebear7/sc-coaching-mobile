import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "./auth-context";
import { TOUR_PAGES, type TourPage } from "./tour-content";

// Member-only, first-login product tour. Two parts:
//   1. A one-time prompt ("take a tour?") the very first time a member's
//      account is ever signed in on this device — covers signup, an
//      explicit login, and a cold-launch session restore alike, since none
//      of those are meaningfully different from the member's point of view.
//   2. If they opt in, a short per-tab card the first time they open each
//      of the 5 tabs (home/schedule/workouts/recovery/nutrition) — "view
//      each page tour as you click into it," not one long modal up front.
// State is persisted per-user (not per-device) so switching accounts on a
// shared device doesn't skip a genuinely new member's first-run prompt.
const STORAGE_PREFIX = "tour-state-v1-";
const ALL_PAGE_KEYS: string[] = TOUR_PAGES.map((p) => p.key);

interface PersistedTourState {
  promptResolved: boolean;
  active: boolean;
  seenPages: string[];
}

function defaultState(): PersistedTourState {
  return { promptResolved: false, active: false, seenPages: [] };
}

async function loadState(userId: string): Promise<PersistedTourState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      promptResolved: !!parsed.promptResolved,
      active: !!parsed.active,
      seenPages: Array.isArray(parsed.seenPages) ? parsed.seenPages.filter((k: unknown) => typeof k === "string") : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState(userId: string, state: PersistedTourState): void {
  AsyncStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(state)).catch(() => {});
}

interface TourContextValue {
  /** The initial "take a tour?" prompt — at most once per account, ever. */
  showPrompt: boolean;
  /** The per-tab card due for the tab currently on screen, if any. */
  activePage: TourPage | null;
  startTour: () => void;
  deferTour: () => void;
  dismissPage: () => void;
  skipTour: () => void;
  /** Settings → "Take app tour": resets progress and jumps to the first tab. */
  restartTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

function tabKeyFromSegments(segments: string[]): string | null {
  // Mirrors (tabs)/_layout.tsx's own currentTabIndex logic — the tour only
  // ever cares about the 5 tab screens, not stack-presented modals/cards
  // pushed on top of them.
  if (segments[0] !== "(tabs)") return null;
  const leaf = segments[segments.length - 1];
  return ALL_PAGE_KEYS.includes(leaf) ? leaf : leaf === "(tabs)" ? "index" : null;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const [state, setState] = useState<PersistedTourState | null>(null);
  const userId = user?.role === "member" ? user.id : null;

  useEffect(() => {
    if (!userId) {
      setState(null);
      return;
    }
    let cancelled = false;
    loadState(userId).then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function persist(next: PersistedTourState) {
    setState(next);
    if (userId) saveState(userId, next);
  }

  const showPrompt = !!(userId && state && !state.promptResolved);

  const currentTabKey = tabKeyFromSegments(segments as string[]);
  const activePage = useMemo(() => {
    if (!userId || !state || showPrompt || !state.active || !currentTabKey) return null;
    if (state.seenPages.includes(currentTabKey)) return null;
    return TOUR_PAGES.find((p) => p.key === currentTabKey) ?? null;
  }, [userId, state, showPrompt, currentTabKey]);

  const startTour = useCallback(() => {
    if (!userId) return;
    persist({ promptResolved: true, active: true, seenPages: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const deferTour = useCallback(() => {
    if (!userId) return;
    persist({ promptResolved: true, active: false, seenPages: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const dismissPage = useCallback(() => {
    if (!userId || !state || !currentTabKey) return;
    const seenPages = state.seenPages.includes(currentTabKey) ? state.seenPages : [...state.seenPages, currentTabKey];
    const complete = ALL_PAGE_KEYS.every((k) => seenPages.includes(k));
    persist({ ...state, seenPages, active: complete ? false : state.active });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state, currentTabKey]);

  const skipTour = useCallback(() => {
    if (!userId || !state) return;
    persist({ ...state, active: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state]);

  const restartTour = useCallback(() => {
    if (!userId) return;
    persist({ promptResolved: true, active: true, seenPages: [] });
    router.replace("/(tabs)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, router]);

  const value: TourContextValue = {
    showPrompt,
    activePage,
    startTour,
    deferTour,
    dismissPage,
    skipTour,
    restartTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
