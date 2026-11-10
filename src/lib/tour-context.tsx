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
import { TOUR_PAGE_KEYS, TOUR_STORAGE_VERSION, findTourPage, pageKeyFromSegments, type TourPage } from "./tour-content";
import { applyDismiss, parseTourState, type PersistedTourState } from "./tour-state";

// Member-only app tour. Two parts:
//   1. A one-time prompt ("want a quick tour?") the first time a member's
//      account is signed in on this device (and once more after a tour
//      version bump, so everyone sees a redesigned tour).
//   2. If they opt in, a short spotlight tour the first time they open each
//      of the tour pages (see tour-content.ts). Settings can restart it.
// State is persisted per user, not per device, so switching accounts on a
// shared device does not skip a genuinely new member's first-run prompt.
const STORAGE_PREFIX = `tour-state-${TOUR_STORAGE_VERSION}-`;

function defaultState(): PersistedTourState {
  return { promptResolved: false, active: false, seenPages: [] };
}

async function loadState(userId: string): Promise<PersistedTourState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? parseTourState(raw) : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState(userId: string, state: PersistedTourState): void {
  AsyncStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(state)).catch(() => {});
}

interface TourContextValue {
  /** The initial "take a tour?" prompt — at most once per account per tour version. */
  showPrompt: boolean;
  /** The tour due for the page currently on screen, if any. */
  activePage: TourPage | null;
  startTour: () => void;
  deferTour: () => void;
  /** The current page's tour is finished: do not show it again. */
  dismissPage: () => void;
  /** Stop the whole tour (it can still be restarted from Settings). */
  skipTour: () => void;
  /** Settings → "Take app tour": resets progress and jumps to Home. */
  restartTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, viewMode } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const [state, setState] = useState<PersistedTourState | null>(null);
  // Members, and staff while they are looking at the app as a member does.
  const userId = user && (user.role === "member" || viewMode === "member") ? user.id : null;

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

  const currentKey = pageKeyFromSegments(segments as string[]);
  const activePage = useMemo(() => {
    if (!userId || !state || showPrompt || !state.active || !currentKey) return null;
    if (state.seenPages.includes(currentKey)) return null;
    return findTourPage(currentKey);
  }, [userId, state, showPrompt, currentKey]);

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
    if (!userId || !state || !currentKey) return;
    persist(applyDismiss(state, currentKey, TOUR_PAGE_KEYS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state, currentKey]);

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
