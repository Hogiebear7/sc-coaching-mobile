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

// User-facing label for the exact region tapped — deliberately NOT the same
// as the zone's own label (e.g. tapping "deltoids" or "biceps" should say
// so, even though both resolve to the coarser "shoulders"/"upper-arms" zone
// for filtering). This is what makes the picker feel anatomically precise
// while the backend still only ever sees the 9 coarse zones. Only the real
// (non-null-mapped) slugs need entries — decorative parts are never tapped.
export const SLUG_LABEL: Partial<Record<Slug, string>> = {
  chest: "Chest",
  biceps: "Biceps",
  triceps: "Triceps",
  abs: "Abs",
  obliques: "Obliques",
  quadriceps: "Quads",
  tibialis: "Shins",
  trapezius: "Traps",
  "upper-back": "Upper Back",
  "lower-back": "Lower Back",
  hamstring: "Hamstrings",
  gluteal: "Glutes",
  deltoids: "Shoulders",
  forearm: "Forearms",
  adductors: "Inner Thighs",
  calves: "Calves",
  neck: "Neck",
};

// Fallback for a chip that was never set from a diagram tap — either it was
// toggled directly in the fallback chip list, or it was already selected
// before this labeling feature existed. Title-cases the raw vendor string
// (e.g. "upper arms" -> "Upper Arms") rather than showing it lowercase.
export function humanizeZoneValue(vendorValue: string): string {
  return vendorValue
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
