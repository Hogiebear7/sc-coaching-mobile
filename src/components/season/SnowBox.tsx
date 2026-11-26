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

/**
 * How far the snow rises above the box, and how far the icicles hang into it, in points. SNOW_RISE has to match how far the cap really rises (SnowCap draws it 11 points
 * above the box), because that room is the box's own top margin: with less, a card that is the first thing in a scroll view had the top of its snow cut off by the
 * scroll view's edge (seen on the Community screen and any screen that opens with a card).
 */
const SNOW_RISE = 11;
const SNOW_DROP = 22;

let nextSeed = 1;

export function SnowBox({ style, children, seed, slot, snow = true, ...rest }: ViewProps & { style?: StyleProp<ViewStyle>; children?: ReactNode; seed?: number; slot?: string; snow?: boolean }) {
  const { season } = useSeason();
  const nested = useContext(SnowNested);
  const [ownSeed] = useState(() => nextSeed++);
  const [tall, setTall] = useState(false);

  if (season?.key !== "christmas" || nested || !snow) {
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

  // Make room for the snow so it never sits on top of text: the lumps rise a little above the box (a label just above it gets a few points more space) and the icicles
  // hang down into it (content that starts right at the top, such as a list of rows with no padding, is pushed down below them). Only in season.
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  outer.marginTop = num(outer.marginTop ?? outer.marginVertical ?? outer.margin) + SNOW_RISE;
  const topPad = inner.paddingTop ?? inner.paddingVertical ?? inner.padding;
  if (num(topPad) < SNOW_DROP) inner.paddingTop = SNOW_DROP;

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
