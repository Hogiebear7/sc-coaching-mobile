import type { Ionicons } from "@expo/vector-icons";

// Content for the per-tab tour cards, shown the first time a member opens
// each tab during an active tour (see lib/tour-context.tsx). `key` must
// match the tab's route segment (same values as (tabs)/_layout.tsx's own
// TAB_SEGMENTS) so the context can tell which tour belongs to the screen
// the member just landed on.
export interface TourPage {
  key: "index" | "schedule" | "workouts" | "recovery" | "nutrition";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  tips: string[];
}

export const TOUR_PAGES: TourPage[] = [
  {
    key: "index",
    icon: "home-outline",
    title: "Home",
    description: "Your daily snapshot — readiness, this week's training, and what's next.",
    tips: [
      "The readiness ring reflects your latest recovery check-in.",
      "Quick actions jump straight into today's workout or a recovery log.",
      "Your next booked session and any coach messages show up here first.",
    ],
  },
  {
    key: "schedule",
    icon: "calendar-outline",
    title: "Schedule",
    description: "Browse classes, book your spot, and see what you've already got coming up.",
    tips: [
      "Switch between Browse, Calendar, and My Bookings at the top.",
      "Full classes let you join a waitlist — you'll be notified if a spot opens.",
      "Reminders for booked classes are set in Settings.",
    ],
  },
  {
    key: "workouts",
    icon: "barbell-outline",
    title: "Workouts",
    description: "Log training sessions, track progress, and reuse programs you've saved.",
    tips: [
      "Tap Log Workout to start today's session, set by set.",
      "The Library holds exercises, your saved templates, and a workout generator.",
      "Trends and personal bests update automatically as you log.",
    ],
  },
  {
    key: "recovery",
    icon: "heart-outline",
    title: "Recovery",
    description: "A quick daily check-in that feeds your readiness score.",
    tips: [
      "Log sleep, soreness, and stress in a few taps each day.",
      "Your readiness trend shows how recent training is landing.",
      "Cycle tracking, if you use it, lives here too.",
    ],
  },
  {
    key: "nutrition",
    icon: "nutrition-outline",
    title: "Nutrition",
    description: "Track today's food and water against your targets.",
    tips: [
      "Log meals by search, barcode scan, or a photo of your plate.",
      "“What Can I Make?” turns a photo or list of ingredients into meal ideas.",
      "Your shopping list and saved recipes are under More Tools.",
    ],
  },
];

export const TOUR_PROMPT = {
  title: "New here? Take a quick tour",
  description:
    "There's a lot in the app — we'll walk you through each tab as you open it, about 20 seconds each. Stop anytime, and you can always restart it from Settings.",
};
