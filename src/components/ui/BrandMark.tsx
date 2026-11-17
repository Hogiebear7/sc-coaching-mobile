import { Image, type ImageStyle } from "expo-image";
import { View } from "react-native";
import { RemoteArt } from "@/components/season/RemoteArt";
import { LogoAccessory } from "@/components/season/seasonArt";
import { useSeason } from "@/lib/season";

// The full brand wordmark (gym-app/public/brand/website-logo-v2.png), copied
// into mobile assets so both apps ship the same logo. Transparent background,
// wide aspect ratio — sized by height like the web app's <img className="h-*">
// usage (see app/(dashboard)/dashboard/layout.tsx and app/(auth)/login/page.tsx).
// v2 replaced the original asset, which had visible gradient banding/
// compression artifacts baked into the pixels.
const LOGO = require("../../../assets/brand/website-logo-v2.png");
const LOGO_ASPECT_RATIO = 975 / 480;

export function BrandMark({ height = 36, style }: { height?: number; style?: ImageStyle }) {
  const { season } = useSeason();
  const width = height * LOGO_ASPECT_RATIO;
  const plain = (
    <>
      <Image source={LOGO} style={[{ width, height }, style]} contentFit="contain" accessibilityLabel="S&C Performance Coaching" />
      {season ? <LogoAccessory season={season.key} height={height} width={width} /> : null}
    </>
  );
  // At Christmas the logo is the owner's Canva picture with the Santa hat already on it (loaded from the website); the plain logo and drawn hat are the fallback.
  if (season?.key === "christmas") {
    return (
      <View style={{ width, height }}>
        <RemoteArt name="logo-christmas" style={[{ width, height }, style]} fallback={plain} />
      </View>
    );
  }
  return <View style={{ width, height }}>{plain}</View>;
}
