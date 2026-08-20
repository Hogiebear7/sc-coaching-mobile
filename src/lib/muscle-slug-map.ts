import type { Slug } from "react-native-body-highlighter";

import type { BodyZoneKey } from "@/lib/body-zones";

// Maps react-native-body-highlighter's 24 anatomical slugs onto the app's 9
// coarse body-part zones (see body-zones.ts) — the exercise library's real
// filter granularity tops out at those 9 values, it has no separate
// "biceps"/"lats"/"glutes" etc. as filterable values. This file is the only
// place that bridges "looks like a named muscle" (what the picker shows)
// and "is actually one of the 9 filterable zones" (what generation uses),
// so BodyDiagram.tsx and workout-generator.tsx never need to know the
// anatomical slug list exists — they only ever see BodyZoneKey.
//
// null = decorative silhouette part with no training-zone meaning (hair,
// head, hands, feet, knees, ankles) — rendered for anatomical completeness,
// never selectable.
//
// Note: the package's README table lists "abductors" as a back-view slug,
// but its actual exported Slug type omits it (docs/type mismatch upstream)
// — "adductors" (which IS a real slug, front+back) covers inner-thigh.
export const ZONE_FOR_SLUG: Record<Slug, BodyZoneKey | null> = {
  // Front
  chest: "chest",
  biceps: "upper-arms",
  abs: "waist",
  obliques: "waist",
  quadriceps: "upper-legs",
  tibialis: "lower-legs",
  knees: null,
  // Back
  trapezius: "back",
  "upper-back": "back",
  "lower-back": "back",
  triceps: "upper-arms",
  hamstring: "upper-legs",
  gluteal: "upper-legs",
  // Both sides
  deltoids: "shoulders",
  forearm: "lower-arms",
  adductors: "upper-legs",
  calves: "lower-legs",
  neck: "neck",
  // Decorative — always present in the silhouette, never a training zone
  hair: null,
  head: null,
  hands: null,
  feet: null,
  ankles: null,
};
