import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

import { RemoteArt } from "@/components/season/RemoteArt";
import { Sprite } from "@/components/season/seasonArt";

// The scene along the bottom of the screen for each season: a strip of ground with a few small drawings standing on it, still, like the corner scenes on the
// seasonal workout posters. Christmas keeps its falling snow (the only thing that moves); everything else is calm.
type ItemKind = "bunny" | "flag" | "pumpkin" | "jack" | "ghost" | "egg" | "shamrock" | "heart" | "arrowHeart" | "ball" | "star" | "pot" | "rainbow" | "sun" | "leaf";
interface Item {
  kind: ItemKind;
  left: `${number}%`;
  size: number;
  lift?: number;
  colour?: string;
  /** A picture from the website (the owner's Canva artwork) drawn instead; the built-in drawing of `kind` is the fallback. aspect is width / height. */
  img?: { name: string; aspect: number };
}

function Art({ kind, size, colour }: { kind: ItemKind; size: number; colour?: string }) {
  switch (kind) {
    case "pumpkin":
    case "jack":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Ellipse cx="12" cy="14.5" rx="9.5" ry="7.5" fill="#f08a24" />
          <Ellipse cx="7.5" cy="14.5" rx="4.2" ry="7.3" fill="#e0731a" />
          <Ellipse cx="16.5" cy="14.5" rx="4.2" ry="7.3" fill="#e0731a" />
          <Ellipse cx="12" cy="14.5" rx="4" ry="7.5" fill="#f5a038" />
          <Rect x="11" y="4.2" width="2.4" height="4" rx="1" fill="#4a7c2a" />
          {kind === "jack" ? (
            <G fill="#3a2410">
              <Path d="M7.5 12 L10 12 L8.7 14.2 Z" />
              <Path d="M14 12 L16.5 12 L15.2 14.2 Z" />
              <Path d="M7.8 17 L9.3 16 L10.8 17.2 L12.2 16 L13.7 17.2 L15.2 16 L16.5 17 L16 18.5 L8.2 18.5 Z" />
            </G>
          ) : null}
        </Svg>
      );
    case "bunny":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Ellipse cx="8.2" cy="7" rx="1.9" ry="5.2" fill="#ffffff" transform="rotate(-8 8.2 7)" />
          <Ellipse cx="8.2" cy="7.4" rx="0.8" ry="3.4" fill="#ffb3c7" transform="rotate(-8 8.2 7.4)" />
          <Ellipse cx="12.6" cy="6.6" rx="1.9" ry="5.4" fill="#ffffff" transform="rotate(8 12.6 6.6)" />
          <Ellipse cx="12.6" cy="7" rx="0.8" ry="3.5" fill="#ffb3c7" transform="rotate(8 12.6 7)" />
          <Ellipse cx="10.4" cy="14" rx="4.6" ry="4" fill="#ffffff" />
          <Ellipse cx="9.4" cy="20" rx="6.2" ry="3.6" fill="#ffffff" />
          <Circle cx="15.8" cy="21" r="2" fill="#f3f3f8" />
          <Circle cx="8.6" cy="13.4" r="0.7" fill="#3a3a46" />
          <Circle cx="12" cy="13.4" r="0.7" fill="#3a3a46" />
          <Circle cx="10.3" cy="15" r="0.7" fill="#ffb3c7" />
        </Svg>
      );
    case "flag":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="4" y="2" width="1.4" height="21" rx="0.7" fill="#8a8a96" />
          <Rect x="5.4" y="3" width="5.6" height="9" fill="#169b62" />
          <Rect x="11" y="3" width="5.6" height="9" fill="#ffffff" />
          <Rect x="16.6" y="3" width="5.6" height="9" fill="#ff883e" />
        </Svg>
      );
    case "ghost":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 22 L4 11 C4 5 8 2 12 2 C16 2 20 5 20 11 L20 22 L17 19.5 L14.5 22 L12 19.5 L9.5 22 L7 19.5 Z" fill="#f4f1ff" />
          <Circle cx="9" cy="10" r="1.7" fill="#2b2540" />
          <Circle cx="15" cy="10" r="1.7" fill="#2b2540" />
          <Ellipse cx="12" cy="14.5" rx="1.6" ry="2" fill="#2b2540" />
        </Svg>
      );
    case "egg":
      return <Sprite kind="egg" size={size} color={colour ?? "#ffd1dc"} />;
    case "shamrock":
      return <Sprite kind="shamrock" size={size} color={colour ?? "#1fa84f"} />;
    case "heart":
      return <Sprite kind="heart" size={size} color={colour ?? "#ff4d6d"} />;
    case "leaf":
      return <Sprite kind="leaf" size={size} color={colour ?? "#e07a1f"} />;
    case "arrowHeart":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 21 C4 14 2 9 2 6.5 C2 3.5 4.5 2 7 2 C9 2 11 3.3 12 5 C13 3.3 15 2 17 2 C19.5 2 22 3.5 22 6.5 C22 9 20 14 12 21 Z" fill="#ff2e63" />
          <Line x1="3" y1="20" x2="21" y2="4" stroke="#8a5a2b" strokeWidth="1.4" strokeLinecap="round" />
          <Path d="M21 4 L17.6 4.8 L20.2 7.4 Z" fill="#8a5a2b" />
          <Path d="M3 20 L2 17.5 M3 20 L5.5 21 M5 18 L3.6 16.8 M5 18 L6.2 19.4" stroke="#8a5a2b" strokeWidth="1.1" />
        </Svg>
      );
    case "ball":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="10" fill="#ffffff" />
          <Path d="M12 12 L12 2 A10 10 0 0 1 20.7 7 Z" fill="#ff5a5f" />
          <Path d="M12 12 L20.7 17 A10 10 0 0 1 12 22 Z" fill="#3aa0ff" />
          <Path d="M12 12 L3.3 17 A10 10 0 0 1 3.3 7 Z" fill="#ffd23f" />
          <Circle cx="12" cy="12" r="1.8" fill="#ffffff" />
        </Svg>
      );
    case "star":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 2 L14.6 9 L22 9.4 L16.2 14 L18.2 21.4 L12 17.2 L5.8 21.4 L7.8 14 L2 9.4 L9.4 9 Z" fill="#ff8a65" />
        </Svg>
      );
    case "pot":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="8" cy="8" r="2.6" fill="#ffd23f" />
          <Circle cx="12.5" cy="6.4" r="2.8" fill="#f1c40f" />
          <Circle cx="16.4" cy="8.4" r="2.5" fill="#ffd23f" />
          <Path d="M4 11 L20 11 C21 16 19 21 12 21.5 C5 21 3 16 4 11 Z" fill="#26262e" />
          <Rect x="3" y="10" width="18" height="2.2" rx="1" fill="#3a3a46" />
        </Svg>
      );
    case "rainbow":
      return (
        <Svg width={size * 1.6} height={size} viewBox="0 0 32 20">
          {["#e74c3c", "#f39c12", "#f1c40f", "#2ecc71", "#3498db", "#8e44ad"].map((c, i) => (
            <Path key={c} d={`M${2 + i * 1.8} 20 A${14 - i * 1.8} ${14 - i * 1.8} 0 0 1 ${30 - i * 1.8} 20`} stroke={c} strokeWidth="1.8" fill="none" />
          ))}
        </Svg>
      );
    case "sun":
      return (
        <Svg width={size} height={size} viewBox="-12 -12 24 24">
          <Circle r="5" fill="#ffd23f" />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <Line key={i} x1={Math.cos(a) * 7} y1={Math.sin(a) * 7} x2={Math.cos(a) * 10.5} y2={Math.sin(a) * 10.5} stroke="#ffd23f" strokeWidth="2" strokeLinecap="round" />;
          })}
        </Svg>
      );
  }
}

const SCENES: Record<string, { strip: "snow" | "grass" | "sand" | "leaves" | "night" | null; items: Item[] }> = {
  christmas: { strip: "snow", items: [] },
  // Just a few small hearts. Not everyone wants Valentine's, so nothing more.
  valentines: {
    strip: null,
    items: [
      { kind: "heart", left: "4%", size: 13, lift: 2, colour: "#ff8fa3" },
      { kind: "heart", left: "9%", size: 10, lift: 2, colour: "#ff4d6d" },
      { kind: "heart", left: "6.5%", size: 11, lift: 12, colour: "#ffb3c1" },
    ],
  },
  // Flag on the left; pot of gold beside the rainbow on the right.
  stpatricks: {
    strip: "grass",
    items: [
      { kind: "flag", left: "5%", size: 26, lift: 8 },
      { kind: "shamrock", left: "40%", size: 18, lift: 9, img: { name: "clover", aspect: 400 / 464 } },
      { kind: "pot", left: "69%", size: 23, lift: 8 },
      { kind: "rainbow", left: "78%", size: 30, lift: 8 },
    ],
  },
  easter: {
    strip: "grass",
    items: [
      { kind: "egg", left: "5%", size: 26, lift: 8, colour: "#ffd1dc", img: { name: "eggs", aspect: 500 / 470 } },
      { kind: "egg", left: "20%", size: 14, lift: 9, colour: "#cde7ff" },
      { kind: "bunny", left: "38%", size: 30, lift: 6 },
      { kind: "egg", left: "62%", size: 15, lift: 9, colour: "#fff1a8" },
      { kind: "egg", left: "86%", size: 30, lift: 8, colour: "#e6d3ff", img: { name: "basket", aspect: 500 / 526 } },
    ],
  },
  halloween: {
    strip: "night",
    items: [
      { kind: "jack", left: "9%", size: 24, lift: 8 },
      { kind: "ghost", left: "46%", size: 24, lift: 10 },
      { kind: "jack", left: "78%", size: 21, lift: 8 },
    ],
  },
};

function Strip({ kind }: { kind: "snow" | "grass" | "sand" | "leaves" | "night" }) {
  const paint = {
    snow: ["#f4f8ff", "#dce8f7"],
    grass: ["#5cbf5a", "#3f9b45"],
    sand: ["#f2d7a0", "#e8c070"],
    leaves: ["#a0521d", "#7a3d14"],
    night: ["#3a2a52", "#241a38"],
  }[kind];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 30" preserveAspectRatio="none">
      {kind === "sand" ? <Path d="M0 30 L0 6 C40 1 80 10 130 5 C180 0 230 10 280 5 C330 1 370 7 400 5 L400 30 Z" fill="#48c1ee" opacity={0.9} /> : null}
      <Path d={kind === "sand" ? "M0 30 L0 15 C50 11 90 18 140 14 C190 10 240 18 290 14 C340 10 380 16 400 14 L400 30 Z" : "M0 30 L0 15 C30 6 60 18 100 12 C140 6 170 18 210 12 C250 6 280 18 320 12 C350 8 380 14 400 16 L400 30 Z"} fill={paint[0]} />
      {kind === "grass" ? (
        <Path
          d={Array.from({ length: 70 }, (_, i) => {
            const x = 3 + i * 5.7 + ((i * 7) % 3);
            const h = 3 + ((i * 5) % 4);
            const lean = ((i * 3) % 5) - 2;
            return `M${x} 15 L${x + lean} ${15 - h} L${x + 1.4} 15 Z`;
          }).join(" ")}
          fill={paint[0]}
          opacity={0.8}
        />
      ) : null}
      <Path d="M0 30 L0 23 C40 19 80 26 130 22 C180 18 230 26 280 22 C330 18 370 24 400 24 L400 30 Z" fill={paint[1]} />
    </Svg>
  );
}

/** The ground and the small drawings standing on it for a season. Draws nothing for a season with no scene. */
export function SeasonGround({ season }: { season: string }) {
  const scene = SCENES[season];
  if (!scene) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34 }}>
      {scene.strip ? <Strip kind={scene.strip} /> : null}
      {scene.items.map((it, i) => (
        <View key={i} style={{ position: "absolute", left: it.left, bottom: it.lift ?? 0 }}>
          {it.img ? (
            <RemoteArt name={it.img.name} style={{ width: it.size * it.img.aspect, height: it.size }} fallback={<Art kind={it.kind} size={it.size} colour={it.colour} />} />
          ) : (
            <Art kind={it.kind} size={it.size} colour={it.colour} />
          )}
        </View>
      ))}
    </View>
  );
}
