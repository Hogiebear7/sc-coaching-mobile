import { Image, type ImageStyle } from "expo-image";

// The full brand wordmark (gym-app/public/brand/website-logo-v2.png), copied
// into mobile assets so both apps ship the same logo. Transparent background,
// wide aspect ratio — sized by height like the web app's <img className="h-*">
// usage (see app/(dashboard)/dashboard/layout.tsx and app/(auth)/login/page.tsx).
// v2 replaced the original asset, which had visible gradient banding/
// compression artifacts baked into the pixels.
const LOGO = require("../../../assets/brand/website-logo-v2.png");
const LOGO_ASPECT_RATIO = 975 / 480;

export function BrandMark({ height = 36, style }: { height?: number; style?: ImageStyle }) {
  return (
    <Image
      source={LOGO}
      style={[{ width: height * LOGO_ASPECT_RATIO, height }, style]}
      contentFit="contain"
      accessibilityLabel="S&C Performance Coaching"
    />
  );
}
