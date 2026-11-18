import { StyleSheet, View } from "react-native";

import { CardEdgeSprites, CardTopDecor, HalloweenCardArt, HalloweenHeaderWeb } from "@/components/season/seasonArt";
import { useSeason } from "@/lib/season";

// The seasonal decoration on the top edge of a card: snow at Christmas (sitting on it, with lumps hanging over the front), hearts, shamrocks, eggs or leaves
// resting on it. At Halloween each piece is fixed to one named card (`slot`, the card's title; see HalloweenCardArt), and a card with no slot gets nothing. The
// name is from when it was only snow. Put it as a child of a card (or a wrapper around one) that does not clip its children; it takes no touches. Nothing is
// drawn when no season is on.
export function SnowCap({ seed = 0, slot }: { seed?: number; slot?: string }) {
  const { season } = useSeason();
  if (!season) return null;
  if (season.key === "halloween") {
    return slot ? (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <HalloweenCardArt slot={slot} />
      </View>
    ) : null;
  }
  const snowy = season.key === "christmas";
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: snowy ? 6 : 0, right: snowy ? 6 : 0, top: snowy ? -11 : 0, height: snowy ? 30 : 0 }}>
      {snowy ? <CardTopDecor season={season.key} seed={seed} /> : <CardEdgeSprites season={season.key} seed={seed} />}
    </View>
  );
}

/** A Halloween-only piece on a card that gets nothing at other times of year (the Community screen). Wrap the card in a View with position "relative" and put this in it. */
export function HalloweenCardDecor({ slot }: { slot: string }) {
  const { season } = useSeason();
  if (season?.key !== "halloween") return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <HalloweenCardArt slot={slot} />
    </View>
  );
}

/** The big cobweb in the top-right corner of the Home top band. Halloween only; the band must be a View that fills its corner. */
export function HalloweenHeaderDecor() {
  const { season } = useSeason();
  if (season?.key !== "halloween") return null;
  return <HalloweenHeaderWeb />;
}
