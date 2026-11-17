import { Image, type ImageStyle } from "expo-image";
import { useState, type ReactNode } from "react";
import type { StyleProp } from "react-native";

import { API_BASE_URL } from "@/constants/config";
import { useSeason } from "@/lib/season";

// The seasonal artwork (the owner's Canva pictures) is loaded from the website, not built into the app: https://sandccoaching.com/seasonal/<name>.png. That way a
// picture can be changed at any time with no new app build (the server's artVersion goes on the address, so a changed picture is downloaded again). Pictures
// are cached on the phone after the first load. If one can't be loaded (offline the first time, or the file is missing) the built-in drawing is shown instead.
export function artUrl(name: string, version: number): string {
  return `${API_BASE_URL}/seasonal/${name}.png?v=${version}`;
}

export function RemoteArt({
  name,
  style,
  fallback = null,
  contentFit = "contain",
}: {
  name: string;
  style?: StyleProp<ImageStyle>;
  /** Shown instead if the picture can't be loaded. */
  fallback?: ReactNode;
  contentFit?: "contain" | "fill" | "cover";
}) {
  const { artVersion } = useSeason();
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <Image
      source={{ uri: artUrl(name, artVersion) }}
      style={style}
      contentFit={contentFit}
      cachePolicy="disk"
      transition={150}
      onError={() => setFailed(true)}
      accessible={false}
    />
  );
}
