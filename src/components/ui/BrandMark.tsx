import { Image, type ImageStyle } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { RemoteArt } from "@/components/season/RemoteArt";
import { LogoAccessory } from "@/components/season/seasonArt";
import { LOGO_BACKGROUND_DARK, LOGO_BACKGROUND_LIGHT, useGymBranding } from "@/lib/gym-branding";
import { useSeason } from "@/lib/season";
import { useAppTheme } from "@/lib/theme";

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
  const branding = useGymBranding();
  const { colors, scheme } = useAppTheme();
  const width = height * LOGO_ASPECT_RATIO;

  // A tenant gym that has set its own look shows it: its logo, or its name when it has no logo. S&C and any gym with nothing set keep the S&C wordmark below.
  if (branding.custom) {
    if (branding.logoUrl) {
      // The gym chose the background its logo looks right on. When that is not the colour of the screen behind it (a white-background logo on the dark app, or the reverse),
      // the logo sits on a small rounded plate of its own background so it never disappears.
      const needsPlate = branding.logoBackground !== (scheme === "light" ? LOGO_BACKGROUND_LIGHT : LOGO_BACKGROUND_DARK);
      if (needsPlate) {
        const pad = Math.max(3, Math.round(height * 0.12));
        return (
          <View style={{ backgroundColor: branding.logoBackground, borderRadius: Math.max(6, Math.round(height * 0.22)), padding: pad, alignSelf: "flex-start" }}>
            <Image source={{ uri: branding.logoUrl }} style={[{ width: width - pad * 2, height: height - pad * 2 }, style]} contentFit="contain" accessibilityLabel={branding.name} />
          </View>
        );
      }
      return (
        <View style={{ width, height }}>
          <Image source={{ uri: branding.logoUrl }} style={[{ width, height }, style]} contentFit="contain" contentPosition="left" accessibilityLabel={branding.name} />
        </View>
      );
    }
    return (
      <View style={[styles.nameBox, { width, height }]}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text, fontSize: Math.max(14, height * 0.5) }]} accessibilityRole="header">
          {branding.name}
        </Text>
      </View>
    );
  }

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

const styles = StyleSheet.create({
  nameBox: { justifyContent: "center" },
  name: { fontWeight: "700" },
});
