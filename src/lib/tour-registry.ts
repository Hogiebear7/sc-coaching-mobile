import { useEffect, type RefObject } from "react";

// How the tour finds the things it spotlights. A screen marks an element by
// spreading `tourTarget("home.next")` onto a View/Pressable; the tour asks
// for its on-screen rectangle when that step is shown. Nothing here renders
// anything, and an element nobody asks about costs one Map entry.

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MeasurableNode {
  measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => void;
}

const nodes = new Map<string, MeasurableNode>();
const propsCache = new Map<string, { ref: (node: unknown) => void; collapsable: false }>();

/**
 * Spread onto a View/Pressable: `<View {...tourTarget("home.next")}>`.
 * `collapsable: false` stops Android flattening the view away, which would
 * leave nothing to measure. The same props object is returned for an id so
 * re-renders do not detach and re-attach the ref.
 */
export function tourTarget(id: string): { ref: (node: unknown) => void; collapsable: false } {
  let props = propsCache.get(id);
  if (!props) {
    let mine: MeasurableNode | null = null;
    props = {
      ref: (node: unknown) => {
        if (node) {
          mine = node as MeasurableNode;
          nodes.set(id, mine);
        } else if (mine && nodes.get(id) === mine) {
          nodes.delete(id);
          mine = null;
        } else {
          mine = null;
        }
      },
      collapsable: false,
    };
    propsCache.set(id, props);
  }
  return props;
}

export function hasTourTarget(id: string): boolean {
  return nodes.has(id);
}

/** The element's rectangle in window coordinates, or null if it is not mounted or has no size. */
export function measureTourTarget(id: string): Promise<TourRect | null> {
  const node = nodes.get(id);
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (rect: TourRect | null) => {
      if (done) return;
      done = true;
      resolve(rect);
    };
    // measureInWindow never calls back for a view that was unmounted mid-call.
    const timer = setTimeout(() => finish(null), 600);
    try {
      node.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        finish(width > 0 && height > 0 && Number.isFinite(x) && Number.isFinite(y) ? { x, y, width, height } : null);
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

// ─── Scrolling a target into view ────────────────────────────────────────────
// Each scrolling screen registers its ScrollView under its tour page key
// (useTourScroll). Before a step is shown the tour asks that scroller to
// bring the target near the top, where the card will not cover it.

type Scroller = (targetId: string) => Promise<boolean>;
const scrollers = new Map<string, Scroller>();

/** Resolves true if the screen scrolled (so the caller should wait for it to settle before measuring). */
export async function scrollTourTargetIntoView(pageKey: string, targetId: string): Promise<boolean> {
  const scroller = scrollers.get(pageKey);
  if (!scroller) return false;
  try {
    return await scroller(targetId);
  } catch {
    // Scrolling is a nicety: a failure leaves the step to its fallback.
    return false;
  }
}

interface ScrollViewLike {
  scrollTo: (opts: { x?: number; y?: number; animated?: boolean }) => void;
  measureInWindow?: MeasurableNode["measureInWindow"];
  getInnerViewRef?: () => MeasurableNode | null | undefined;
}

function measure(node: MeasurableNode | null | undefined): Promise<TourRect | null> {
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 600);
    try {
      node.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        resolve({ x, y, width, height });
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Where to scroll to so a target sits comfortably near the top of the viewport, or null to leave it alone. */
export function scrollOffsetFor(args: { viewportTop: number; viewportHeight: number; contentTop: number; targetTop: number; targetHeight: number }): number | null {
  const { viewportTop, viewportHeight, contentTop, targetTop, targetHeight } = args;
  const margin = 24;
  const relativeTop = targetTop - viewportTop;
  const comfortablyVisible = relativeTop >= margin && relativeTop + Math.min(targetHeight, viewportHeight * 0.4) <= viewportHeight * 0.55;
  if (comfortablyVisible) return null;
  const targetInContent = targetTop - contentTop;
  return Math.max(0, Math.round(targetInContent - 96));
}

/** Register a screen's ScrollView so tour steps can scroll to their target. */
export function useTourScroll(pageKey: string, ref: RefObject<unknown>): void {
  useEffect(() => {
    scrollers.set(pageKey, async (targetId) => {
      const sv = ref.current as ScrollViewLike | null;
      const node = nodes.get(targetId);
      if (!sv || !node || typeof sv.scrollTo !== "function") return false;
      const viewport = await measure(sv as unknown as MeasurableNode);
      // A plain ScrollView can name its content view. Wrapped ones (the
      // keyboard-aware scroll) cannot, so those screens put a zero-height
      // `<View {...tourTarget("<page>.top")} />` first inside the content.
      const inner = (sv.getInnerViewRef ? sv.getInnerViewRef() : null) ?? nodes.get(`${pageKey}.top`) ?? null;
      const content = await measure(inner);
      const target = await measure(node);
      if (!viewport || !content || !target) return false;
      const y = scrollOffsetFor({
        viewportTop: viewport.y,
        viewportHeight: viewport.height,
        contentTop: content.y,
        targetTop: target.y,
        targetHeight: target.height,
      });
      if (y === null) return false;
      sv.scrollTo({ y, animated: true });
      return true;
    });
    return () => {
      scrollers.delete(pageKey);
    };
  }, [pageKey, ref]);
}
