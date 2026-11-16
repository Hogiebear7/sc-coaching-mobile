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
  /**
   * True while the tour is, or is about to be, on screen (including while its
   * saved state is still loading). A page's own one-off pop-ups wait for this
   * to be false so they never open on top of a tour step.
   */
  holdTips: boolean;
  /** A screen asks for the first of these tours that the member has not seen yet (they show once, whether or not the main tour is on). */
  requestFeatureTour: (keys: string[]) => void;
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
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
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
  const featurePage = useMemo(() => {
    if (!userId || !state || showPrompt || !requestedKey) return null;
    if (state.seenPages.includes(requestedKey)) return null;
    return findTourPage(requestedKey);
  }, [userId, state, showPrompt, requestedKey]);
  const routePage = useMemo(() => {
    if (!userId || !state || showPrompt || !state.active || !currentKey) return null;
    if (state.seenPages.includes(currentKey)) return null;
    return findTourPage(currentKey);
  }, [userId, state, showPrompt, currentKey]);
  const activePage = featurePage ?? routePage;

  const requestFeatureTour = useCallback(
    (keys: string[]) => {
      if (!userId || !state || !state.promptResolved) return;
      setRequestedKey((prev) => {
        if (prev && !state.seenPages.includes(prev)) return prev;
        return keys.find((k) => !state.seenPages.includes(k)) ?? null;
      });
    },
    [userId, state]
  );

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

  const featureKey = featurePage ? featurePage.key : null;
  const dismissPage = useCallback(() => {
    if (!userId || !state) return;
    if (featureKey) {
      persist(applyDismiss(state, featureKey, TOUR_PAGE_KEYS));
      setRequestedKey(null);
      return;
    }
    if (!currentKey) return;
    persist(applyDismiss(state, currentKey, TOUR_PAGE_KEYS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state, currentKey, featureKey]);

  const skipTour = useCallback(() => {
    if (!userId || !state) return;
    // Skipping one screen's tips never switches off the main tour.
    if (featureKey) {
      persist(applyDismiss(state, featureKey, TOUR_PAGE_KEYS));
      setRequestedKey(null);
      return;
    }
    persist({ ...state, active: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state, featureKey]);

  const restartTour = useCallback(() => {
    if (!userId) return;
    persist({ promptResolved: true, active: true, seenPages: [] });
    router.replace("/(tabs)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, router]);

  const holdTips = !!userId && (state === null || showPrompt || activePage !== null);

  const value: TourContextValue = {
    showPrompt,
    activePage,
    holdTips,
    requestFeatureTour,
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
