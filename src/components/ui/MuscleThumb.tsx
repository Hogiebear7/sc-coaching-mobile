import { View } from "react-native";
import Body, { type ExtendedBodyPart } from "react-native-body-highlighter";

import type { MuscleFocus } from "@/lib/exercise-muscles";
import { useProfile } from "@/lib/queries/profile";
import { useAppTheme } from "@/lib/theme";

// A small crop of the same anatomical body the Generate screen uses, with
// the exercise's main muscles in the primary ink and the helpers in the data
// blue. The body is drawn larger than the thumbnail and cropped to the
// region that matters (shoulders-to-waist, the middle, or the legs).
const NATIVE_W = 200;
const NATIVE_H = 400;
// Top of the crop window, as a share of the body's height.
const REGION_TOP: Record<MuscleFocus["region"], number> = { upper: 0.16, middle: 0.25, lower: 0.44 };

export function MuscleThumb({ focus, size = 40 }: { focus: MuscleFocus; size?: number }) {
  const { colors, data } = useAppTheme();
  const { data: profile } = useProfile();
  const sex = profile?.gender === "Female" ? "female" : "male";

  // The visible crop is a bit under half the body's height.
  const bodyH = size * 2.1;
  const scale = bodyH / NATIVE_H;
  const bodyW = NATIVE_W * scale;

  const parts: ExtendedBodyPart[] = [
    ...focus.secondary.map((slug) => ({ slug, color: data.load })),
    ...focus.primary.map((slug) => ({ slug, color: colors.text })),
  ];

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.bg, alignItems: "center" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ position: "absolute", top: -bodyH * REGION_TOP[focus.region], left: (size - bodyW) / 2, width: bodyW, height: bodyH }}>
        <Body data={parts} gender={sex} side={focus.side} scale={scale} border={colors.hairline} defaultFill={colors.control} />
      </View>
    </View>
  );
}
