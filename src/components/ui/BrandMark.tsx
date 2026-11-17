import { Image, type ImageStyle } from "expo-image";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useSeason } from "@/lib/season";

// The full brand wordmark (gym-app/public/brand/website-logo-v2.png), copied
// into mobile assets so both apps ship the same logo. Transparent background,
// wide aspect ratio — sized by height like the web app's <img className="h-*">
// usage (see app/(dashboard)/dashboard/layout.tsx and app/(auth)/login/page.tsx).
// v2 replaced the original asset, which had visible gradient banding/
// compression artifacts baked into the pixels.
const LOGO = require("../../../assets/brand/website-logo-v2.png");
const LOGO_ASPECT_RATIO = 975 / 480;

// A Santa hat on the logo while the Christmas season is on (from the server, see lib/season.ts). The home-screen app icon never changes.
function SantaHat({ height }: { height: number }) {
  const h = height * 0.62;
  const w = h * (64 / 52);
  return (
    <Svg
      width={w}
      height={h}
      viewBox="0 0 64 52"
      style={{ position: "absolute", left: -height * 0.12, top: -height * 0.3, transform: [{ rotate: "-14deg" }] }}
    >
      <Path d="M6 40 C8 18 24 4 46 6 C40 12 38 20 44 30 C48 36 52 40 56 42 Z" fill="#d6262c" />
      <Path d="M6 40 C8 18 24 4 46 6 C42 9 38 14 36 20 C26 22 14 30 6 40 Z" fill="#ee4a4a" opacity={0.55} />
      <Path d="M3 41 C20 37 42 38 60 45 C61 49 58 51 55 50 C40 45 20 44 6 48 C3 49 1 45 3 41 Z" fill="#ffffff" />
      <Circle cx="47" cy="6" r="6" fill="#ffffff" />
    </Svg>
  );
}

export function BrandMark({ height = 36, style }: { height?: number; style?: ImageStyle }) {
  const { season } = useSeason();
  return (
    <View style={{ width: height * LOGO_ASPECT_RATIO, height }}>
      <Image
        source={LOGO}
        style={[{ width: height * LOGO_ASPECT_RATIO, height }, style]}
        contentFit="contain"
        accessibilityLabel="S&C Performance Coaching"
      />
      {season?.hat ? <SantaHat height={height} /> : null}
    </View>
  );
}
