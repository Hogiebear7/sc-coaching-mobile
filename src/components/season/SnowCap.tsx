import { View } from "react-native";


import { CardEdgeSprites, CardTopDecor } from "@/components/season/seasonArt";
import { useSeason } from "@/lib/season";

// The seasonal decoration on the top edge of a card: snow at Christmas (sitting on it, with lumps hanging over the front), hearts, shamrocks, eggs or leaves
// resting on it, and spiders hanging from it at Halloween. The name is from when it was only snow. Put it as a child of a card (or a wrapper around one) that
// does not clip its children; it takes no touches. Nothing is drawn when no season is on.
export function SnowCap({ seed = 0 }: { seed?: number }) {
  const { season } = useSeason();
  if (!season) return null;
  const snowy = season.key === "christmas";
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: snowy ? 6 : 0, right: snowy ? 6 : 0, top: snowy ? -11 : 0, height: snowy ? 30 : 0 }}>
      {snowy ? <CardTopDecor season={season.key} seed={seed} /> : <CardEdgeSprites season={season.key} seed={seed} />}
    </View>
  );
}
