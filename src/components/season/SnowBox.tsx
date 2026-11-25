import { createContext, useContext, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

import { SnowCap } from "@/components/season/SnowCap";
import { useSeason } from "@/lib/season";

// A box (a card, a list card) that wears snow along its top edge at Christmas. Out of season it is exactly a plain View with the same style, so nothing about the
// layout can change for the rest of the year.
//
// In season the box is split in two so the snow can hang over its edge without being clipped by the box's own rounded corners: an outer View that carries the
// LAYOUT style (margins, flex, width and the like, so the box sits exactly where it did) and an inner View that carries everything else (background, radius, padding,
// clipping), with the snow drawn on top of both. Only the outermost box gets snow (a card inside a card does not), and a box too short to carry it, such as a chip,
// is left plain.

const SnowNested = createContext(false);

const LAYOUT_KEYS = new Set([
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
  "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "position", "top", "left", "right", "bottom", "zIndex", "aspectRatio", "display",
]);

/** Boxes shorter than this are chips and rows, not cards. */
const MIN_HEIGHT_FOR_SNOW = 64;

let nextSeed = 1;

export function SnowBox({ style, children, seed, slot, ...rest }: ViewProps & { style?: StyleProp<ViewStyle>; children?: ReactNode; seed?: number; slot?: string }) {
  const { season } = useSeason();
  const nested = useContext(SnowNested);
  const [ownSeed] = useState(() => nextSeed++);
  const [tall, setTall] = useState(false);

  if (season?.key !== "christmas" || nested) {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }

  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (LAYOUT_KEYS.has(k) ? outer : inner)[k] = v;
  const absolute = outer.position === "absolute";

  const onLayout = (e: LayoutChangeEvent) => {
    const big = e.nativeEvent.layout.height >= MIN_HEIGHT_FOR_SNOW;
    if (big !== tall) setTall(big);
    rest.onLayout?.(e);
  };

  return (
    <View {...rest} style={[outer as ViewStyle, { position: absolute ? "absolute" : "relative" }]} onLayout={onLayout}>
      <SnowNested.Provider value>
        <View style={[inner as ViewStyle, { flexGrow: 1 }]}>{children}</View>
      </SnowNested.Provider>
      {tall ? <SnowCap seed={seed ?? ownSeed} slot={slot} /> : null}
    </View>
  );
}
