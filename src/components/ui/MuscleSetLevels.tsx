import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Color } from "@/constants/theme";
import type { SetLevelTier, StrengthSection } from "@/lib/workout-set-levels";

// RN port of the web app's components/graphics/MuscleSetLevels.tsx — same
// geometry as MuscleMap.tsx (the per-exercise single-zone indicator), but
// every zone renders simultaneously at a graded intensity instead of one
// zone being on/off. Rendered in the accent-data blue, not gold: this is
// an analytical/informational surface (weekly training volume), not a
// brand-action moment.

type Zone = "front-upper" | "front-core" | "front-legs" | "back-upper" | "back-lower";

const ZONE_BY_SECTION: Record<StrengthSection, Zone> = {
  upper_push: "front-upper",
  core: "front-core",
  lower_push: "front-legs",
  upper_pull: "back-upper",
  lower_pull: "back-lower",
};

const MUTED = "rgba(255,255,255,0.14)";
const MUTED_STROKE = "rgba(255,255,255,0.22)";

const TIER_OPACITY: Record<Exclude<SetLevelTier, "none">, number> = {
  low: 0.38,
  moderate: 0.68,
  high: 1,
};

function fillFor(zone: Zone, byZone: Partial<Record<Zone, SetLevelTier>>): { fill: string; fillOpacity: number } {
  const tier = byZone[zone] ?? "none";
  if (tier === "none") return { fill: MUTED, fillOpacity: 1 };
  return { fill: Color.accentData, fillOpacity: TIER_OPACITY[tier] };
}

function FrontBody({ byZone }: { byZone: Partial<Record<Zone, SetLevelTier>> }) {
  const upper = fillFor("front-upper", byZone);
  const core = fillFor("front-core", byZone);
  const legs = fillFor("front-legs", byZone);
  return (
    <Svg viewBox="0 0 100 200" width="100%" height="100%">
      <Circle cx={50} cy={16} r={12} fill={MUTED} stroke={MUTED_STROKE} strokeWidth={1} />
      <Rect x={12} y={34} width={12} height={52} rx={6} fill={upper.fill} fillOpacity={upper.fillOpacity} />
      <Rect x={76} y={34} width={12} height={52} rx={6} fill={upper.fill} fillOpacity={upper.fillOpacity} />
      <Rect x={26} y={30} width={48} height={36} rx={14} fill={upper.fill} fillOpacity={upper.fillOpacity} />
      <Rect x={32} y={64} width={36} height={34} rx={10} fill={core.fill} fillOpacity={core.fillOpacity} />
      <Rect x={30} y={96} width={40} height={18} rx={9} fill={MUTED} />
      <Rect x={32} y={112} width={16} height={48} rx={7} fill={legs.fill} fillOpacity={legs.fillOpacity} />
      <Rect x={52} y={112} width={16} height={48} rx={7} fill={legs.fill} fillOpacity={legs.fillOpacity} />
      <Rect x={33} y={162} width={14} height={34} rx={6} fill={MUTED} />
      <Rect x={53} y={162} width={14} height={34} rx={6} fill={MUTED} />
    </Svg>
  );
}

function BackBody({ byZone }: { byZone: Partial<Record<Zone, SetLevelTier>> }) {
  const upper = fillFor("back-upper", byZone);
  const lower = fillFor("back-lower", byZone);
  return (
    <Svg viewBox="0 0 100 200" width="100%" height="100%">
      <Circle cx={50} cy={16} r={12} fill={MUTED} stroke={MUTED_STROKE} strokeWidth={1} />
      <Rect x={12} y={34} width={12} height={52} rx={6} fill={upper.fill} fillOpacity={upper.fillOpacity} />
      <Rect x={76} y={34} width={12} height={52} rx={6} fill={upper.fill} fillOpacity={upper.fillOpacity} />
      <Path
        d="M26 30 h48 a14 14 0 0 1 14 14 v6 a34 34 0 0 1 -76 0 v-6 a14 14 0 0 1 14 -14 z"
        fill={upper.fill}
        fillOpacity={upper.fillOpacity}
      />
      <Rect x={34} y={66} width={32} height={30} rx={9} fill={MUTED} />
      <Rect x={30} y={96} width={40} height={22} rx={11} fill={lower.fill} fillOpacity={lower.fillOpacity} />
      <Rect x={32} y={118} width={16} height={42} rx={7} fill={lower.fill} fillOpacity={lower.fillOpacity} />
      <Rect x={52} y={118} width={16} height={42} rx={7} fill={lower.fill} fillOpacity={lower.fillOpacity} />
      <Rect x={33} y={160} width={14} height={36} rx={6} fill={MUTED} />
      <Rect x={53} y={160} width={14} height={36} rx={6} fill={MUTED} />
    </Svg>
  );
}

// Front + back pair, always shown together — the five tracked sections
// span both views (upper_pull/lower_pull only ever show on the back), so
// a front-only diagram would silently hide two-fifths of the picture.
export function MuscleSetLevelDiagram({
  levels,
  height = 176,
}: {
  levels: Record<StrengthSection, { tier: SetLevelTier }>;
  height?: number;
}) {
  const byZone: Partial<Record<Zone, SetLevelTier>> = {};
  (Object.keys(levels) as StrengthSection[]).forEach((section) => {
    byZone[ZONE_BY_SECTION[section]] = levels[section].tier;
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <View style={{ height, width: Math.min(height * 0.625, 110) }}>
        <FrontBody byZone={byZone} />
      </View>
      <View style={{ height, width: Math.min(height * 0.625, 110) }}>
        <BackBody byZone={byZone} />
      </View>
    </View>
  );
}
