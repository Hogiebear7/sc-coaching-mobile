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
 * Where (top edge, in px) the tour card sits for a spotlight: just below it
 * if it fits, else just above, else pinned to the bottom of the screen. With
 * no spotlight the card is centred.
 */
export function placeCard(args: {
  hole: { y: number; h: number } | null;
  cardH: number;
  screenH: number;
  insetTop: number;
  insetBottom: number;
}): number {
  const { hole, cardH, screenH, insetTop, insetBottom } = args;
  const gap = 14;
  const margin = 12;
  if (!hole) return Math.round((screenH - cardH) / 2);
  const below = hole.y + hole.h + gap;
  if (below + cardH <= screenH - insetBottom - margin) return Math.round(below);
  const above = hole.y - gap - cardH;
  if (above >= insetTop + margin) return Math.round(above);
  return Math.round(screenH - insetBottom - margin - cardH);
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
