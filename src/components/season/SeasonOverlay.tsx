import { AccessibilityInfo, Dimensions, StyleSheet, Text, View } from "react-native";

import { FireworksShow } from "@/components/season/FireworksShow";
import { SeasonGround } from "@/components/season/seasonScenes";
import { SnowField } from "@/components/season/SnowField";
import { useSeason } from "@/lib/season";

// Falling snow (see SnowField), a drift along the bottom of the screen, and (1 and 2 January) a New Year burst of fireworks, drawn over the Home screen. Light on purpose: about
// 30 flakes on the native animation thread, never takes a touch, switches off for people who reduce motion on their phone, and stays off when the member turns
// "Seasonal effects" off in Settings or the server says there is no season.
let reduceMotionCache = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotionCache = v;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
  reduceMotionCache = v;
});

export function SeasonOverlay({ surface = "home" }: { surface?: "home" | "community" | "splash" }) {
  const { season, overlay, greeting } = useSeason();
  const { width, height } = Dimensions.get("window");

  if (!season) return null;
  // The Community screen only gets the Christmas / New Year and Halloween looks (owner, 2026-11-17).
  if (surface === "community" && season.key !== "christmas" && season.key !== "halloween") return null;
  const reduceMotion = reduceMotionCache;
  // Only snow falls (owner, 2026-11-17: no falling hearts, shamrocks, eggs or leaves). Everything else is a calm scene along the bottom.
  const falling = season.particle === "snow";
  const message = overlay ? "Happy New Year" : greeting;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {falling && !reduceMotion ? <SnowField width={width} height={height} /> : null}
      {overlay?.fireworks && !reduceMotion ? <FireworksShow width={width} height={height} surface={surface} /> : null}
      {surface === "splash" && message ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: height * 0.62, alignItems: "center" }}>
          <Text style={{ color: "#e3b341", fontSize: 30, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center" }}>{message}</Text>
        </View>
      ) : null}
      <SeasonGround season={overlay ? "christmas" : season.key} />
    </View>
  );
}
