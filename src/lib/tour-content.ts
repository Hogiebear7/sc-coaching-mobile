import type { Ionicons } from "@expo/vector-icons";

// Content and routing for the app tour (see lib/tour-context.tsx for the
// state machine and components/ui/TourOverlay.tsx for the spotlight UI).
//
// A page tour is a short run of steps. A step with a `target` spotlights the
// matching element, which a screen marks with `tourTarget(id)` from
// lib/tour-registry.ts; a step without one is a plain card. If a target is
// not on screen for this member (a gym-only card for an app-only member, say)
// the step is skipped, so the copy below must make sense whichever steps
// survive. Write in the guide's voice: warm, direct, second person.

export type TourPageKey =
  | "index"
  | "schedule"
  | "workouts"
  | "recovery"
  | "nutrition"
  | "community"
  | "profile"
  | "settings";

export interface TourStep {
  /** Unique within the page; used as a React key and in tests. */
  id: string;
  /** A tourTarget() id to spotlight. Omit for a card with no spotlight. */
  target?: string;
  title: string;
  body: string;
}

export interface TourPage {
  key: TourPageKey;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  steps: TourStep[];
}

// Bumped from "v1" (the old one-card-per-tab tour) so every member sees the
// new tour once, including members who finished or skipped the old one.
export const TOUR_STORAGE_VERSION = "v2";

export const TOUR_PROMPT = {
  title: "Want a quick tour?",
  body: "I'll show you around each page the first time you open it. It's about 20 seconds a page, and you can stop any time. You can replay it later from Settings.",
  start: "Show me around",
  later: "Maybe later",
};

export const TOUR_PAGES: TourPage[] = [
  {
    key: "index",
    icon: "grid-outline",
    title: "Home",
    steps: [
      {
        id: "today",
        target: "home.today",
        title: "Start here each morning",
        body: "Check in on sleep, soreness and fatigue and you get a readiness score. The button underneath is always the next best thing to do today.",
      },
      {
        id: "next",
        target: "home.next",
        title: "What's coming up",
        body: "Your next booked class, or today's workout if you train with the app. One tap and you're there.",
      },
      {
        id: "recovery",
        target: "home.recovery",
        title: "Your numbers",
        body: "Readiness, sleep, training load and sessions. Tap any tile to see how it's trending.",
      },
      {
        id: "club",
        target: "home.club",
        title: "Your club",
        body: "Your plan, a direct line to your coach, and Community: leaderboards, private groups and challenges.",
      },
      {
        id: "bar",
        target: "tabs.bar",
        title: "Your tab bar",
        body: "Home, two tabs of your choosing, and More for everything else. Long-press one of the middle tabs to swap it.",
      },
      {
        id: "add",
        target: "tabs.add",
        title: "The + button",
        body: "Log a workout, a meal, water, a weigh-in or a check-in from anywhere in the app. This is the one you'll use most.",
      },
    ],
  },
  {
    key: "schedule",
    icon: "calendar-outline",
    title: "Schedule",
    steps: [
      {
        id: "views",
        target: "schedule.views",
        title: "Find a class",
        body: "Switch between Browse, Calendar and My Bookings. Pick a day to see what's on.",
      },
      {
        id: "body",
        target: "schedule.body",
        title: "Book your spot",
        body: "Tap a class to book. If it's full you can join the waitlist, and I'll let you know if a place opens up.",
      },
    ],
  },
  {
    key: "workouts",
    icon: "barbell-outline",
    title: "Train",
    steps: [
      {
        id: "week",
        target: "train.week",
        title: "Your week at a glance",
        body: "Workouts, sets and total volume so far this week. Tap a day on the strip to look back at what you did.",
      },
      {
        id: "log",
        target: "train.actions",
        title: "Log a session",
        body: "The + starts a workout, set by set. The clock shows your full history.",
      },
      {
        id: "programme",
        target: "train.programme",
        title: "Your programme",
        body: "If you're following a programme, today's session is here with a Start button. Swap an exercise or skip a day any time.",
      },
      {
        id: "tools",
        target: "train.tools",
        title: "Handy tools",
        body: "A plate calculator, a rest timer, a workout generator and tracker import. They're quick to reach when your hands are chalky.",
      },
    ],
  },
  {
    key: "recovery",
    icon: "heart-outline",
    title: "Recovery",
    steps: [
      {
        id: "readiness",
        target: "recovery.readiness",
        title: "How ready are you?",
        body: "Your readiness score for today and what it means for training. It gets smarter the more you check in.",
      },
      {
        id: "week",
        target: "recovery.week",
        title: "This week",
        body: "Readiness, training load, sleep and check-ins side by side. Tap a tile to dig into it.",
      },
      {
        id: "checkin",
        target: "recovery.checkin",
        title: "Check in",
        body: "Sleep, soreness and fatigue take a few taps. Injured or feeling unwell? Add a note at the bottom and your coach and the AI will take it into account.",
      },
    ],
  },
  {
    key: "nutrition",
    icon: "restaurant-outline",
    title: "Nutrition",
    steps: [
      {
        id: "calories",
        target: "nutrition.calories",
        title: "Today's calories",
        body: "What you've eaten against your target. Tap it for the Day and Week breakdown, or ask why your number is what it is.",
      },
      {
        id: "macros",
        target: "nutrition.macros",
        title: "Protein, carbs and fat",
        body: "Tap any of these to see what it is and why it matters.",
      },
      {
        id: "log",
        target: "nutrition.log",
        title: "Log your food",
        body: "Search, scan a barcode or snap a photo of your plate. It's quicker than it sounds.",
      },
      {
        id: "diary",
        target: "nutrition.diary",
        title: "Your diary",
        body: "Meal by meal. Tap a meal to open it, or the cross on an item to remove it.",
      },
      {
        id: "hydration",
        target: "nutrition.hydration",
        title: "Water",
        body: "Use the quick-add buttons, or type a total.",
      },
    ],
  },
  {
    key: "community",
    icon: "people-outline",
    title: "Community",
    steps: [
      {
        id: "find",
        target: "community.find",
        title: "Find people",
        body: "Search by name to follow friends. Only people who've chosen to be found will show up.",
      },
      {
        id: "groups",
        target: "community.groups",
        title: "Private groups",
        body: "Start a group, share the invite code and set challenges. Squat PB, 5K time, most volume, or build your own.",
      },
      {
        id: "gym",
        target: "community.gym",
        title: "Your gym",
        body: "A members-only feed for your gym: share a win, comment, and join gym-wide challenges.",
      },
      {
        id: "leaderboard",
        target: "community.leaderboard",
        title: "The leaderboard",
        body: "Pick what you're ranked on and over what time. Follow someone and a Friends view appears, so you can race the people you know.",
      },
    ],
  },
  {
    key: "profile",
    icon: "person-outline",
    title: "Profile",
    steps: [
      {
        id: "goals",
        target: "profile.goals",
        title: "Your goals",
        body: "Tell me what you're working toward. Your coach and the AI shape your training and nutrition around this.",
      },
      {
        id: "body",
        target: "profile.body",
        title: "Body metrics",
        body: "Log your weight and body fat here. Your calorie target and progress charts are built from it.",
      },
      {
        id: "timeline",
        target: "profile.timeline",
        title: "Your goal timeline",
        body: "Set a goal weight or body fat and how many days a week you can train, then tap Generate. You get a target date and the weekly pace it takes, and your calorie target adjusts to match, capped at a safe rate. It's the part that keeps you honest.",
      },
      {
        id: "cycle",
        target: "profile.cycle",
        title: "Cycle and pregnancy",
        body: "Private to you unless you choose to share it with your coach. If you're pregnant, this becomes your day, week and trimester guide.",
      },
      {
        id: "settings",
        target: "profile.settings",
        title: "Settings",
        body: "Account, membership, notifications and your tab bar. I'll show you the useful bits next.",
      },
    ],
  },
  {
    key: "settings",
    icon: "settings-outline",
    title: "Settings",
    steps: [
      {
        id: "tabbar",
        target: "settings.tabbar",
        title: "Choose your tabs",
        body: "Pick the two tabs either side of the + button. You can also long-press one in the tab bar to swap it.",
      },
      {
        id: "training",
        target: "settings.training",
        title: "Set up your gym",
        body: "Tell me what equipment you have access to, and the exercise library only shows what you can actually do. Add a profile for home, the gym, or both.",
      },
      {
        id: "calories",
        target: "settings.calories",
        title: "Calorie targets",
        body: "Set your weekly pace and activity, and choose the same target every day or one that matches your training.",
      },
      {
        id: "privacy",
        target: "settings.privacy",
        title: "Who can find you",
        body: "Control whether you show up in search and on leaderboards, and the name other members see.",
      },
      {
        id: "replay",
        target: "settings.tour",
        title: "That's the tour",
        body: "Want to see it again? Tap Take app tour any time and I'll walk you through it from the start.",
      },
    ],
  },
];

export const TOUR_PAGE_KEYS: TourPageKey[] = TOUR_PAGES.map((p) => p.key);

const TAB_PAGE_KEYS: TourPageKey[] = ["index", "schedule", "workouts", "recovery", "nutrition"];

/**
 * Which tour page (if any) the route segments belong to. Only the screens
 * themselves count: a sub-screen pushed on top (community/groups, a session
 * detail, a modal) has no tour, so the tour never fires over it.
 */
export function pageKeyFromSegments(segments: readonly string[]): TourPageKey | null {
  const first = segments[0];
  if (first === "(tabs)") {
    const leaf = segments[segments.length - 1];
    if (leaf === "(tabs)") return "index";
    return (TAB_PAGE_KEYS as string[]).includes(leaf) ? (leaf as TourPageKey) : null;
  }
  if (segments.length === 1 && (first === "community" || first === "profile" || first === "settings")) {
    return first;
  }
  return null;
}

export function findTourPage(key: string | null): TourPage | null {
  if (!key) return null;
  return TOUR_PAGES.find((p) => p.key === key) ?? null;
}
