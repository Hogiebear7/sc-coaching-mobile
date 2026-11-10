// @ts-nocheck -- scans the source tree with Node's fs and path; the app tsconfig has no Node types. It runs under vitest (Node), not in the app.
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  TOUR_PAGES,
  TOUR_PAGE_KEYS,
  TOUR_STORAGE_VERSION,
  findTourPage,
  pageKeyFromSegments,
} from "@/lib/tour-content";
import { hasTourTarget, measureTourTarget, scrollOffsetFor, tourTarget } from "@/lib/tour-registry";
import { applyDismiss, nextVisibleStep, parseTourState, placeCard } from "@/lib/tour-state";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(tsx|ts)$/.test(name) ? [full] : [];
  });
}

describe("tour content", () => {
  it("covers the eight pages, in a sensible order", () => {
    expect(TOUR_PAGE_KEYS).toEqual(["index", "schedule", "workouts", "recovery", "nutrition", "community", "profile", "settings"]);
  });

  it("every step has a title and a body, and step ids are unique within a page", () => {
    for (const page of TOUR_PAGES) {
      expect(page.steps.length).toBeGreaterThan(0);
      const ids = page.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of page.steps) {
        expect(s.title.trim().length).toBeGreaterThan(2);
        expect(s.body.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("the Home tour points at the tab bar and the + button, and Settings ends on how to replay the tour", () => {
    const home = findTourPage("index")!;
    expect(home.steps.map((s) => s.target)).toEqual(expect.arrayContaining(["tabs.bar", "tabs.add"]));
    const settings = findTourPage("settings")!;
    expect(settings.steps[settings.steps.length - 1].target).toBe("settings.tour");
    expect(settings.steps.map((s) => s.target)).toEqual(expect.arrayContaining(["settings.tabbar", "settings.training"]));
  });

  it("the Profile tour covers the goal timeline", () => {
    expect(findTourPage("profile")!.steps.some((s) => s.target === "profile.timeline")).toBe(true);
  });

  it("every spotlight id in the content is marked on a screen with tourTarget()", () => {
    const source = sourceFiles(join(process.cwd(), "src"))
      .filter((f) => !f.includes("__tests__") && !f.endsWith("tour-content.ts"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const missing: string[] = [];
    for (const page of TOUR_PAGES) {
      for (const step of page.steps) {
        if (step.target && !source.includes(`tourTarget("${step.target}")`)) missing.push(`${page.key}/${step.id}: ${step.target}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("uses a new storage version, so everyone sees the redesigned tour once more", () => {
    expect(TOUR_STORAGE_VERSION).not.toBe("v1");
  });
});

describe("pageKeyFromSegments", () => {
  it("maps the tab screens", () => {
    expect(pageKeyFromSegments(["(tabs)"])).toBe("index");
    expect(pageKeyFromSegments(["(tabs)", "index"])).toBe("index");
    expect(pageKeyFromSegments(["(tabs)", "schedule"])).toBe("schedule");
    expect(pageKeyFromSegments(["(tabs)", "workouts"])).toBe("workouts");
    expect(pageKeyFromSegments(["(tabs)", "recovery"])).toBe("recovery");
    expect(pageKeyFromSegments(["(tabs)", "nutrition"])).toBe("nutrition");
  });

  it("maps Community, Profile and Settings, but only the screens themselves", () => {
    expect(pageKeyFromSegments(["community"])).toBe("community");
    expect(pageKeyFromSegments(["profile"])).toBe("profile");
    expect(pageKeyFromSegments(["settings"])).toBe("settings");
    expect(pageKeyFromSegments(["community", "groups"])).toBeNull();
    expect(pageKeyFromSegments(["community", "group", "[id]"])).toBeNull();
  });

  it("gives nothing for More, other screens, sign-in and an empty route", () => {
    expect(pageKeyFromSegments(["(tabs)", "more"])).toBeNull();
    expect(pageKeyFromSegments(["log-workout"])).toBeNull();
    expect(pageKeyFromSegments(["(auth)", "login"])).toBeNull();
    expect(pageKeyFromSegments([])).toBeNull();
  });
});

describe("saved tour state", () => {
  it("reads good state and shrugs off bad state", () => {
    expect(parseTourState(JSON.stringify({ promptResolved: true, active: true, seenPages: ["index", 3, "schedule"] }))).toEqual({
      promptResolved: true,
      active: true,
      seenPages: ["index", "schedule"],
    });
    expect(parseTourState("not json")).toEqual({ promptResolved: false, active: false, seenPages: [] });
    expect(parseTourState("null")).toEqual({ promptResolved: false, active: false, seenPages: [] });
    expect(parseTourState(JSON.stringify({ seenPages: "index" }))).toEqual({ promptResolved: false, active: false, seenPages: [] });
  });

  it("marks a page seen once, and switches the tour off when every page has been seen", () => {
    const start = { promptResolved: true, active: true, seenPages: [] as string[] };
    const one = applyDismiss(start, "index", TOUR_PAGE_KEYS);
    expect(one.seenPages).toEqual(["index"]);
    expect(one.active).toBe(true);
    expect(applyDismiss(one, "index", TOUR_PAGE_KEYS).seenPages).toEqual(["index"]);
    const all = TOUR_PAGE_KEYS.reduce((s, k) => applyDismiss(s, k, TOUR_PAGE_KEYS), start);
    expect(all.active).toBe(false);
    expect(all.seenPages).toHaveLength(TOUR_PAGE_KEYS.length);
  });
});

describe("nextVisibleStep", () => {
  const present = (missing: number[]) => (i: number) => !missing.includes(i);
  it("steps forwards and backwards over steps whose target is not on screen", () => {
    expect(nextVisibleStep(5, 0, 1, present([1, 2]))).toBe(3);
    expect(nextVisibleStep(5, 3, -1, present([1, 2]))).toBe(0);
    expect(nextVisibleStep(5, 0, 1, present([]))).toBe(1);
  });
  it("says so when there is nothing further", () => {
    expect(nextVisibleStep(5, 4, 1, present([]))).toBe(-1);
    expect(nextVisibleStep(5, 2, 1, present([3, 4]))).toBe(-1);
    expect(nextVisibleStep(5, 0, -1, present([]))).toBe(-1);
  });
});

describe("placeCard", () => {
  const screen = { screenH: 800, insetTop: 40, insetBottom: 20 };
  it("puts the card just below a spotlight that leaves room", () => {
    expect(placeCard({ hole: { y: 100, h: 120 }, cardH: 260, ...screen })).toBe(234);
  });
  it("puts it just above when there is no room below (the tab bar, a low card)", () => {
    expect(placeCard({ hole: { y: 700, h: 90 }, cardH: 260, ...screen })).toBe(426);
  });
  it("pins it to the bottom when it fits neither side, so a tall target is still readable", () => {
    expect(placeCard({ hole: { y: 150, h: 560 }, cardH: 300, ...screen })).toBe(468);
  });
  it("centres it when there is no spotlight", () => {
    expect(placeCard({ hole: null, cardH: 260, ...screen })).toBe(270);
  });
});

describe("tour target registry", () => {
  it("registers a node by ref, returns the same props each time, and forgets it on unmount", () => {
    const props = tourTarget("test.a");
    expect(tourTarget("test.a")).toBe(props);
    expect(props.collapsable).toBe(false);
    expect(hasTourTarget("test.a")).toBe(false);
    const node = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(10, 20, 300, 80) };
    props.ref(node);
    expect(hasTourTarget("test.a")).toBe(true);
    props.ref(null);
    expect(hasTourTarget("test.a")).toBe(false);
  });

  it("measures a mounted node and gives null for a missing, zero-size or silent one", async () => {
    tourTarget("test.b").ref({ measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(5, 6, 100, 40) });
    expect(await measureTourTarget("test.b")).toEqual({ x: 5, y: 6, width: 100, height: 40 });
    expect(await measureTourTarget("test.nothing")).toBeNull();
    tourTarget("test.c").ref({ measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 0, 0, 0) });
    expect(await measureTourTarget("test.c")).toBeNull();
    tourTarget("test.d").ref({
      measureInWindow: () => {
        throw new Error("gone");
      },
    });
    expect(await measureTourTarget("test.d")).toBeNull();
  });

});

describe("scrollOffsetFor", () => {
  const viewport = { viewportTop: 100, viewportHeight: 700 };
  it("leaves a target that is already comfortably in view alone", () => {
    expect(scrollOffsetFor({ ...viewport, contentTop: 100, targetTop: 200, targetHeight: 120 })).toBeNull();
  });
  it("scrolls a target below the fold up to near the top", () => {
    // 1200px down the content: scroll so it sits about 96px under the top.
    expect(scrollOffsetFor({ ...viewport, contentTop: 100, targetTop: 1300, targetHeight: 200 })).toBe(1104);
  });
  it("scrolls back up when the target is above the viewport, and never below zero", () => {
    expect(scrollOffsetFor({ ...viewport, contentTop: -900, targetTop: 90, targetHeight: 100 })).toBe(894);
    expect(scrollOffsetFor({ ...viewport, contentTop: 100, targetTop: 60, targetHeight: 100 })).toBe(0);
  });
});
