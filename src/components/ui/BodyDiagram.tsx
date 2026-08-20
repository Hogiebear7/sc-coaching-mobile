import Svg, { Circle, Rect } from "react-native-svg";

import { Color } from "@/constants/theme";
import { BODY_ZONES, type BodyZoneKey } from "@/lib/body-zones";

// Stylized (not medical/anatomical) tappable body diagram — geometric
// blocks in a body-like arrangement, same philosophy as the web app's
// MuscleMap.tsx reference, ported to react-native-svg and re-keyed off the
// real exercise-library bodyPart taxonomy instead of that component's own
// unrelated section enum.
//
// One shared coordinate layout for front/back — the two views only differ
// in the central torso zone (chest vs back) and a couple of decorative
// front-only details (face dots), since the underlying library taxonomy
// doesn't distinguish "front waist" from "back waist" etc.

const VIEWBOX_W = 200;
const VIEWBOX_H = 360;

type Sex = "male" | "female";

// Subtle silhouette variation — narrower shoulders/upper-arms and a bit
// more hip width for the female variant. Not an attempt at anatomical
// accuracy, just enough to visually differentiate the two.
function layoutFor(sex: Sex) {
  const shoulderSpan = sex === "female" ? 14 : 22;
  const hipSpan = sex === "female" ? 6 : 0;
  return {
    shoulderLeftX: 40 - shoulderSpan / 2,
    shoulderRightX: 122 + shoulderSpan / 2,
    armLeftX: 22 - shoulderSpan / 2,
    armRightX: 152 + shoulderSpan / 2,
    hipLeftX: 68 - hipSpan / 2,
    hipRightX: 102 + hipSpan / 2,
  };
}

export interface BodyDiagramProps {
  view: "front" | "back";
  sex: Sex;
  isZoneSelected: (key: BodyZoneKey) => boolean;
  isZoneAvailable: (key: BodyZoneKey) => boolean;
  onToggleZone: (key: BodyZoneKey) => void;
}

export function BodyDiagram({ view, sex, isZoneSelected, isZoneAvailable, onToggleZone }: BodyDiagramProps) {
  const l = layoutFor(sex);

  function fillFor(key: BodyZoneKey) {
    if (!isZoneAvailable(key)) return Color.surface2;
    return isZoneSelected(key) ? Color.gold : Color.surface1;
  }
  function strokeFor(key: BodyZoneKey) {
    return isZoneSelected(key) && isZoneAvailable(key) ? Color.gold : Color.borderSubtle;
  }
  function press(key: BodyZoneKey) {
    if (!isZoneAvailable(key)) return;
    onToggleZone(key);
  }

  const torsoKey: BodyZoneKey = view === "front" ? "chest" : "back";

  return (
    <Svg width="100%" viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} style={{ aspectRatio: VIEWBOX_W / VIEWBOX_H }}>
      {/* Head — decorative, not tappable */}
      <Circle cx={100} cy={30} r={22} fill={Color.surface2} stroke={Color.borderSubtle} strokeWidth={1.5} />

      {/* Neck */}
      <Rect
        x={88} y={50} width={24} height={16} rx={4}
        fill={fillFor("neck")} stroke={strokeFor("neck")} strokeWidth={1.5}
        onPress={() => press("neck")}
      />

      {/* Shoulders (bilateral — one zone) */}
      <Rect
        x={l.shoulderLeftX} y={66} width={38} height={18} rx={7}
        fill={fillFor("shoulders")} stroke={strokeFor("shoulders")} strokeWidth={1.5}
        onPress={() => press("shoulders")}
      />
      <Rect
        x={l.shoulderRightX - 38} y={66} width={38} height={18} rx={7}
        fill={fillFor("shoulders")} stroke={strokeFor("shoulders")} strokeWidth={1.5}
        onPress={() => press("shoulders")}
      />

      {/* Chest / Back — central torso, upper */}
      <Rect
        x={70} y={68} width={60} height={50} rx={8}
        fill={fillFor(torsoKey)} stroke={strokeFor(torsoKey)} strokeWidth={1.5}
        onPress={() => press(torsoKey)}
      />

      {/* Waist — central torso, lower */}
      <Rect
        x={72} y={118} width={56} height={46} rx={8}
        fill={fillFor("waist")} stroke={strokeFor("waist")} strokeWidth={1.5}
        onPress={() => press("waist")}
      />

      {/* Upper arms (bilateral) */}
      <Rect
        x={l.armLeftX} y={84} width={26} height={70} rx={10}
        fill={fillFor("upper-arms")} stroke={strokeFor("upper-arms")} strokeWidth={1.5}
        onPress={() => press("upper-arms")}
      />
      <Rect
        x={l.armRightX - 26} y={84} width={26} height={70} rx={10}
        fill={fillFor("upper-arms")} stroke={strokeFor("upper-arms")} strokeWidth={1.5}
        onPress={() => press("upper-arms")}
      />

      {/* Lower arms (bilateral) */}
      <Rect
        x={l.armLeftX - 4} y={154} width={24} height={60} rx={10}
        fill={fillFor("lower-arms")} stroke={strokeFor("lower-arms")} strokeWidth={1.5}
        onPress={() => press("lower-arms")}
      />
      <Rect
        x={l.armRightX - 20} y={154} width={24} height={60} rx={10}
        fill={fillFor("lower-arms")} stroke={strokeFor("lower-arms")} strokeWidth={1.5}
        onPress={() => press("lower-arms")}
      />

      {/* Upper legs (bilateral) */}
      <Rect
        x={l.hipLeftX} y={164} width={30} height={90} rx={11}
        fill={fillFor("upper-legs")} stroke={strokeFor("upper-legs")} strokeWidth={1.5}
        onPress={() => press("upper-legs")}
      />
      <Rect
        x={l.hipRightX - 30} y={164} width={30} height={90} rx={11}
        fill={fillFor("upper-legs")} stroke={strokeFor("upper-legs")} strokeWidth={1.5}
        onPress={() => press("upper-legs")}
      />

      {/* Lower legs (bilateral) */}
      <Rect
        x={70} y={254} width={26} height={100} rx={10}
        fill={fillFor("lower-legs")} stroke={strokeFor("lower-legs")} strokeWidth={1.5}
        onPress={() => press("lower-legs")}
      />
      <Rect
        x={104} y={254} width={26} height={100} rx={10}
        fill={fillFor("lower-legs")} stroke={strokeFor("lower-legs")} strokeWidth={1.5}
        onPress={() => press("lower-legs")}
      />
    </Svg>
  );
}

export const ALL_BODY_ZONE_KEYS: BodyZoneKey[] = BODY_ZONES.map((z) => z.key);
