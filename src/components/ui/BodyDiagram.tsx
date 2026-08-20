import { useWindowDimensions, View } from "react-native";
import Body, { type ExtendedBodyPart, type Slug } from "react-native-body-highlighter";

import { Color } from "@/constants/theme";
import { BODY_ZONES, type BodyZoneKey } from "@/lib/body-zones";
import { ZONE_FOR_SLUG } from "@/lib/muscle-slug-map";

// Real anatomical silhouette (react-native-body-highlighter) instead of
// the earlier geometric-block placeholder — genuine front/back SVG paths
// with named muscle regions, male/female variants. This component only
// ever speaks BodyZoneKey to the outside world; ZONE_FOR_SLUG is the sole
// bridge between the picker's ~20 anatomical regions and the exercise
// library's 9 actual filterable body parts, so workout-generator.tsx needs
// no changes — same isZoneSelected/isZoneAvailable/onToggleZone contract
// as the component it replaces.

// The package renders at a fixed 200x400 * scale pixel size (not
// percentage-based), so scale is derived from the window width to fill the
// available column responsively across phone sizes, capped so it doesn't
// blow out on tablets.
const NATIVE_W = 200;
const HORIZONTAL_INSET = 64; // ~ screen padding either side of the diagram column

type Sex = "male" | "female";

export interface BodyDiagramProps {
  view: "front" | "back";
  sex: Sex;
  isZoneSelected: (key: BodyZoneKey) => boolean;
  isZoneAvailable: (key: BodyZoneKey) => boolean;
  onToggleZone: (key: BodyZoneKey) => void;
}

const UNAVAILABLE_FILL = "rgba(255,255,255,0.05)";

export function BodyDiagram({ view, sex, isZoneSelected, isZoneAvailable, onToggleZone }: BodyDiagramProps) {
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max((width - HORIZONTAL_INSET) / NATIVE_W, 1.2), 2.1);

  const data: ExtendedBodyPart[] = (Object.keys(ZONE_FOR_SLUG) as Slug[]).reduce<ExtendedBodyPart[]>(
    (acc, slug) => {
      const zone = ZONE_FOR_SLUG[slug];
      if (!zone) return acc; // decorative part — left at defaultFill, never selectable
      const available = isZoneAvailable(zone);
      const selected = available && isZoneSelected(zone);
      acc.push({
        slug,
        color: selected ? Color.gold : available ? Color.surface2 : UNAVAILABLE_FILL,
      });
      return acc;
    },
    []
  );

  function handlePress(part: ExtendedBodyPart) {
    const zone = part.slug ? ZONE_FOR_SLUG[part.slug] : null;
    if (!zone || !isZoneAvailable(zone)) return;
    onToggleZone(zone);
  }

  return (
    <View style={{ alignItems: "center" }} accessibilityLabel={`${sex} body diagram, ${view} view`}>
      <Body
        data={data}
        gender={sex}
        side={view}
        scale={scale}
        border={Color.borderSubtle}
        defaultFill={Color.surface1}
        onBodyPartPress={handlePress}
      />
    </View>
  );
}

export const ALL_BODY_ZONE_KEYS: BodyZoneKey[] = BODY_ZONES.map((z) => z.key);
