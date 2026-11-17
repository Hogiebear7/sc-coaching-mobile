import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useSeason } from "@/lib/season";

// Snow sitting on the top edge of a card, with a few lumps hanging over the front. Drawn only while a season with snow is on. Put it as a child of a card (or a
// wrapper around one) that doesn't clip its children; it takes no touches.
export function SnowCap({ seed = 0 }: { seed?: number }) {
  const { season } = useSeason();
  if (!season?.pile) return null;
  // Vary the shape a little per card so a row of cards doesn't look stamped.
  const shift = (seed * 37) % 60;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 6, right: 6, top: -9, height: 22 }}>
      <Svg width="100%" height="100%" viewBox="0 0 400 22" preserveAspectRatio="none">
        <Path
          d={`M0 12 C20 3 ${50 + shift} 2 ${90 + shift} 7 C${130 + shift} 1 ${170 + shift} 2 ${210 + shift} 6 C${250 + shift} 0 ${300} 3 ${340} 6 C370 4 392 8 400 12 L400 14 C390 12 380 15 370 14 C365 20 355 20 352 14 C300 16 ${270 + shift} 13 ${230 + shift} 15 C${224 + shift} 21 ${214 + shift} 21 ${210 + shift} 15 C170 15 130 13 ${100} 15 C94 20 84 20 80 14 C50 14 20 15 0 14 Z`}
          fill="#f7faff"
        />
        <Path d="M0 12 C20 3 70 2 120 8" stroke="#dce8f7" strokeWidth="1.2" fill="none" opacity={0.7} />
        <Circle cx={Math.round(60 + shift)} cy="16" r="3" fill="#f7faff" />
        <Circle cx={Math.round(280 + shift / 2)} cy="16" r="2.6" fill="#f7faff" />
      </Svg>
    </View>
  );
}
