import { useWindowDimensions, View } from "react-native";
import Body, { type ExtendedBodyPart, type Slug } from "react-native-body-highlighter";

import { Color } from "@/constants/theme";
import { BODY_ZONES, type BodyZoneKey } from "@/lib/body-zones";
import { SLUG_LABEL, ZONE_FOR_SLUG } from "@/lib/muscle-slug-map";

// Real anatomical silhouette (react-native-body-highlighter) instead of
// the earlier geometric-block placeholder — genuine front/back SVG paths
// with named muscle regions, male/female variants. This component only
// ever speaks BodyZoneKey to the outside world; ZONE_FOR_SLUG is the sole
// bridge between the picker's ~20 anatomical regions and the exercise
// library's 9 actual filterable body parts, so workout-generator.tsx's
// actual generation logic needs no changes — only the display-label
// plumbing (see onToggleZone below) is new.

// The package renders at a fixed 200x400 * scale pixel size (not
// percentage-based), so scale is derived from the window width to fill the
// available column responsively across phone sizes, capped so it doesn't
// blow out on tablets. Slightly larger ceiling than the first pass so the
// figure reads as a centerpiece rather than a small icon.
const NATIVE_W = 200;
const HORIZONTAL_INSET = 48;

type Sex = "male" | "female";
export type ZoneSelectionState = "none" | "primary" | "secondary" | "both";

export interface BodyDiagramProps {
  view: "front" | "back";
  sex: Sex;
  zoneSelection: (key: BodyZoneKey) => ZoneSelectionState;
  isZoneAvailable: (key: BodyZoneKey) => boolean;
  /** Fires with both the coarse filter zone AND the friendly label of the
      exact anatomical region tapped (e.g. "Biceps"), so the caller can show
      that precise label in its chip list while still filtering on the
      coarser zone underneath. */
  onToggleZone: (key: BodyZoneKey, label: string) => void;
}

// Three-tier resting palette: decorative parts fade almost into the panel
// background, tappable-but-unselected parts sit one step brighter (an
// implicit "you can tap these" cue), unavailable parts fade further than
// decorative ones so they read as excluded rather than merely quiet.
const DECORATIVE_FILL = Color.surface1;
const AVAILABLE_FILL = Color.surface2;
const UNAVAILABLE_FILL = "rgba(255,255,255,0.04)";
// Secondary uses the app's existing data-accent blue rather than a second
// gold tone, so primary vs secondary reads unambiguously at a glance
// without inventing a new brand color.
const SECONDARY_FILL = Color.accentData;

export function BodyDiagram({ view, sex, zoneSelection, isZoneAvailable, onToggleZone }: BodyDiagramProps) {
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max((width - HORIZONTAL_INSET) / NATIVE_W, 1.3), 2.3);

  const data: ExtendedBodyPart[] = (Object.keys(ZONE_FOR_SLUG) as Slug[]).reduce<ExtendedBodyPart[]>(
    (acc, slug) => {
      const zone = ZONE_FOR_SLUG[slug];
      if (!zone) return acc; // decorative part — left at defaultFill, never selectable
      const available = isZoneAvailable(zone);
      const state = available ? zoneSelection(zone) : "none";
      const color =
        state === "primary" || state === "both"
          ? Color.gold
          : state === "secondary"
            ? SECONDARY_FILL
            : available
              ? AVAILABLE_FILL
              : UNAVAILABLE_FILL;
      acc.push({ slug, color });
      return acc;
    },
    []
  );

  function handlePress(part: ExtendedBodyPart) {
    const slug = part.slug;
    const zone = slug ? ZONE_FOR_SLUG[slug] : null;
    if (!zone || !slug || !isZoneAvailable(zone)) return;
    onToggleZone(zone, SLUG_LABEL[slug] ?? slug);
  }

  return (
    <View
      style={{ alignItems: "center" }}
      accessible
      accessibilityRole="none"
      accessibilityLabel={`Body diagram, ${view} view. Tap a muscle group to add it to your workout focus.`}
    >
      <Body
        data={data}
        gender={sex}
        side={view}
        scale={scale}
        border={Color.borderSubtle}
        defaultFill={DECORATIVE_FILL}
        onBodyPartPress={handlePress}
      />
    </View>
  );
}

export const ALL_BODY_ZONE_KEYS: BodyZoneKey[] = BODY_ZONES.map((z) => z.key);
