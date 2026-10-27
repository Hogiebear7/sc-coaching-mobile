import type { Slug } from "react-native-body-highlighter";

import type { ExerciseSection } from "@/lib/queries/workouts";

// Which muscles an exercise works, for the small body thumbnails beside
// logged exercises. Uses the exercise's library section when there is one,
// otherwise reads the name ("Prone Hamstring Curl" -> hamstrings).

export interface MuscleFocus {
  side: "front" | "back";
  primary: Slug[];
  secondary: Slug[];
  /** Which part of the body the thumbnail crops to. */
  region: "upper" | "middle" | "lower";
}

const BY_SECTION: Record<ExerciseSection, MuscleFocus> = {
  upper_push: { side: "front", primary: ["chest", "deltoids"], secondary: ["triceps"], region: "upper" },
  upper_pull: { side: "back", primary: ["upper-back", "trapezius"], secondary: ["deltoids", "forearm"], region: "upper" },
  lower_push: { side: "front", primary: ["quadriceps"], secondary: ["adductors", "calves"], region: "lower" },
  lower_pull: { side: "back", primary: ["hamstring", "gluteal"], secondary: ["lower-back", "calves"], region: "lower" },
  core: { side: "front", primary: ["abs", "obliques"], secondary: [], region: "middle" },
  cardio: { side: "front", primary: ["quadriceps", "calves"], secondary: ["chest"], region: "lower" },
};

// Name rules, most specific first.
const BY_NAME: [RegExp, MuscleFocus][] = [
  [/band walk|monster walk|clam|abduct/i, { side: "back", primary: ["gluteal"], secondary: ["adductors"], region: "lower" }],
  [/hamstring|leg curl|nordic|rdl|romanian|good ?morning|stiff[- ]leg/i, BY_SECTION.lower_pull],
  [/glute|hip thrust|bridge|kickback|deadlift|swing|pull[- ]?through/i, BY_SECTION.lower_pull],
  [/calf|calves/i, { side: "back", primary: ["calves"], secondary: [], region: "lower" }],
  [/squat|lunge|leg press|step[- ]?up|leg extension|split/i, BY_SECTION.lower_push],
  [/bicep|hammer curl|preacher|chin[- ]?up/i, { side: "front", primary: ["biceps"], secondary: ["forearm"], region: "upper" }],
  [/tricep|skull ?crusher|pushdown|dip/i, { side: "back", primary: ["triceps"], secondary: ["deltoids"], region: "upper" }],
  [/rower|rowing machine|\berg\b|ski ?erg/i, BY_SECTION.cardio],
  [/row|pull[- ]?up|pulldown|face pull|lat\b|shrug/i, BY_SECTION.upper_pull],
  [/shoulder|overhead|lateral raise|front raise|arnold|military|delt/i, { side: "front", primary: ["deltoids"], secondary: ["triceps", "trapezius"], region: "upper" }],
  [/bench|press|push[- ]?up|fly|chest/i, BY_SECTION.upper_push],
  [/plank|crunch|sit[- ]?up|ab\b|abs\b|core|twist|leg raise|dead ?bug|pallof|hollow/i, BY_SECTION.core],
  [/run|walk|bike|cycle|stair|cross[- ]?trainer|sled|carry|burpee|jump/i, BY_SECTION.cardio],
];

export function muscleFocusFor(name: string, section?: ExerciseSection | null): MuscleFocus | null {
  for (const [re, focus] of BY_NAME) if (re.test(name)) return focus;
  return section ? BY_SECTION[section] : null;
}
