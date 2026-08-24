import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Color } from "@/constants/theme";
import type { ExerciseSection } from "@/lib/queries/workouts";

// RN port of the web app's components/graphics/MuscleMap.tsx — same
// geometry (viewBox 0 0 100 200, identical block coordinates) so the two
// read as the same illustration system, just on different platforms.
// Stylized "athletic emblem" body built from rounded blocks, not an
// anatomical diagram — driven directly by the exercise's existing
// ExerciseSection tag, no new data.

type Zone = "front-upper" | "front-core" | "front-legs" | "back-upper" | "back-lower" | "cardio";

const ZONE_BY_SECTION: Record<ExerciseSection, Zone> = {
  upper_push: "front-upper",
  core: "front-core",
  lower_push: "front-legs",
  upper_pull: "back-upper",
  lower_pull: "back-lower",
  cardio: "cardio",
};

export const MUSCLE_GROUP_LABEL: Record<ExerciseSection, { primary: string; secondary: string }> = {
  upper_push: { primary: "Chest, shoulders", secondary: "Triceps" },
  upper_pull: { primary: "Back, lats", secondary: "Biceps, rear shoulders" },
  lower_push: { primary: "Quads", secondary: "Glutes" },
  lower_pull: { primary: "Hamstrings, glutes", secondary: "Lower back" },
  core: { primary: "Abs, obliques", secondary: "Hip flexors" },
  cardio: { primary: "Heart, lungs", secondary: "Full body" },
};

const VIEW_BY_SECTION: Record<ExerciseSection, "front" | "back"> = {
  upper_push: "front",
  core: "front",
  lower_push: "front",
  upper_pull: "back",
  lower_pull: "back",
  cardio: "front",
};

const MUTED = "rgba(255,255,255,0.14)";
const MUTED_STROKE = "rgba(255,255,255,0.22)";

function fill(active: boolean): string {
  return active ? Color.gold : MUTED;
}

function FrontBody({ zone }: { zone: Zone | null }) {
  const upperOn = zone === "front-upper" || zone === "cardio";
  const coreOn = zone === "front-core";
  const legsOn = zone === "front-legs";
  return (
    <Svg viewBox="0 0 100 200" width="100%" height="100%">
      <Circle cx={50} cy={16} r={12} fill={MUTED} stroke={MUTED_STROKE} strokeWidth={1} />
      <Rect x={12} y={34} width={12} height={52} rx={6} fill={fill(upperOn)} />
      <Rect x={76} y={34} width={12} height={52} rx={6} fill={fill(upperOn)} />
      <Rect x={26} y={30} width={48} height={36} rx={14} fill={fill(upperOn)} />
      <Rect x={32} y={64} width={36} height={34} rx={10} fill={fill(coreOn)} />
      <Rect x={30} y={96} width={40} height={18} rx={9} fill={MUTED} />
      <Rect x={32} y={112} width={16} height={48} rx={7} fill={fill(legsOn)} />
      <Rect x={52} y={112} width={16} height={48} rx={7} fill={fill(legsOn)} />
      <Rect x={33} y={162} width={14} height={34} rx={6} fill={MUTED} />
      <Rect x={53} y={162} width={14} height={34} rx={6} fill={MUTED} />
      {zone === "cardio" ? (
        <Path
          d="M50 40 L58 40 L62 30 L68 54 L74 40 L84 40"
          stroke={Color.gold}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
}

function BackBody({ zone }: { zone: Zone | null }) {
  const upperOn = zone === "back-upper";
  const lowerOn = zone === "back-lower";
  return (
    <Svg viewBox="0 0 100 200" width="100%" height="100%">
      <Circle cx={50} cy={16} r={12} fill={MUTED} stroke={MUTED_STROKE} strokeWidth={1} />
      <Rect x={12} y={34} width={12} height={52} rx={6} fill={fill(upperOn)} />
      <Rect x={76} y={34} width={12} height={52} rx={6} fill={fill(upperOn)} />
      <Path
        d="M26 30 h48 a14 14 0 0 1 14 14 v6 a34 34 0 0 1 -76 0 v-6 a14 14 0 0 1 14 -14 z"
        fill={fill(upperOn)}
      />
      <Rect x={34} y={66} width={32} height={30} rx={9} fill={MUTED} />
      <Rect x={30} y={96} width={40} height={22} rx={11} fill={fill(lowerOn)} />
      <Rect x={32} y={118} width={16} height={42} rx={7} fill={fill(lowerOn)} />
      <Rect x={52} y={118} width={16} height={42} rx={7} fill={fill(lowerOn)} />
      <Rect x={33} y={160} width={14} height={36} rx={6} fill={MUTED} />
      <Rect x={53} y={160} width={14} height={36} rx={6} fill={MUTED} />
    </Svg>
  );
}

// Compact single-view icon — picks whichever silhouette (front/back) best
// shows the exercise's zone. Used inline beside an exercise name in a list
// row, mirroring the web app's Workouts history.
export function MuscleMap({ section, size = 16 }: { section: ExerciseSection; size?: number }) {
  const zone = ZONE_BY_SECTION[section];
  const view = VIEW_BY_SECTION[section];
  return (
    <View style={{ width: size * 0.6, height: size }}>
      {view === "front" ? <FrontBody zone={zone} /> : <BackBody zone={zone} />}
    </View>
  );
}

// Full front + back pair, for an expanded/detail moment — always shows
// both silhouettes so the trained zone reads clearly against the rest of
// the body, not just as an isolated on/off icon.
export function MuscleMapDual({ section, height = 128 }: { section: ExerciseSection; height?: number }) {
  const zone = ZONE_BY_SECTION[section];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <View style={{ height, width: height * 0.55 }}>
        <FrontBody zone={zone} />
      </View>
      <View style={{ height, width: height * 0.55 }}>
        <BackBody zone={zone} />
      </View>
    </View>
  );
}
