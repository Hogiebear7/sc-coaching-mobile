// Pure pieces of the tour's saved state and step flow, kept out of the React
// files so they can be unit-tested.

export interface PersistedTourState {
  promptResolved: boolean;
  active: boolean;
  seenPages: string[];
}

/** Read saved state defensively: anything malformed falls back to "never seen". */
export function parseTourState(raw: string): PersistedTourState {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedTourState> | null;
    return {
      promptResolved: !!parsed?.promptResolved,
      active: !!parsed?.active,
      seenPages: Array.isArray(parsed?.seenPages) ? parsed.seenPages.filter((k): k is string => typeof k === "string") : [],
    };
  } catch {
    return { promptResolved: false, active: false, seenPages: [] };
  }
}

/** Mark a page's tour as done. The whole tour switches off once every page has been seen. */
export function applyDismiss(state: PersistedTourState, pageKey: string, allPageKeys: readonly string[]): PersistedTourState {
  const seenPages = state.seenPages.includes(pageKey) ? state.seenPages : [...state.seenPages, pageKey];
  const complete = allPageKeys.every((k) => seenPages.includes(k));
  return { ...state, seenPages, active: complete ? false : state.active };
}

/**
 * Next step to show after `from`, skipping steps whose target is not on
 * screen. `present(i)` says whether step i can be shown. Returns -1 when
 * there are no more steps in that direction.
 */
export function nextVisibleStep(total: number, from: number, direction: 1 | -1, present: (index: number) => boolean): number {
  for (let i = from + direction; i >= 0 && i < total; i += direction) {
    if (present(i)) return i;
  }
  return -1;
}
