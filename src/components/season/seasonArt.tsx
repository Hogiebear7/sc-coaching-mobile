import { Animated, Easing, View } from "react-native";
import { useEffect, useState } from "react";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

// The drawings for every season, as simple vector shapes (a stand-in for the Canva artwork, which can replace any piece later). Everything here is pure drawing:
// which season is on, and where it goes, is decided by SeasonOverlay, SnowCap and BrandMark.
export type SpriteKind = "heart" | "shamrock" | "egg" | "leaf";

export const SPRITE_COLOURS: Record<SpriteKind, string[]> = {
  heart: ["#ff4d6d", "#ff8fa3", "#ff2e63", "#ffb3c1"],
  shamrock: ["#1fa84f", "#2ecc71", "#178a3f"],
  egg: ["#ffd1dc", "#cde7ff", "#fff1a8", "#d6f5d6", "#e6d3ff"],
  leaf: ["#e07a1f", "#c0392b", "#f1c40f", "#a0521d"],
};

export function Sprite({ kind, size, color }: { kind: SpriteKind; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === "heart" ? (
        <Path d="M12 21 C4 14 2 9 2 6.5 C2 3.5 4.5 2 7 2 C9 2 11 3.3 12 5 C13 3.3 15 2 17 2 C19.5 2 22 3.5 22 6.5 C22 9 20 14 12 21 Z" fill={color} />
      ) : null}
      {kind === "shamrock" ? (
        <G>
          <Circle cx="12" cy="7" r="5" fill={color} />
          <Circle cx="7" cy="13" r="5" fill={color} />
          <Circle cx="17" cy="13" r="5" fill={color} />
          <Path d="M12 12 L13.4 22" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </G>
      ) : null}
      {kind === "egg" ? (
        <G>
          <Ellipse cx="12" cy="13" rx="7" ry="9" fill={color} />
          <Path d="M5.4 12 L8 10.5 L10.5 12 L13 10.5 L15.5 12 L18.6 10.5" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
          <Path d="M6 16 Q12 19 18 16" stroke="#ffffff" strokeWidth="1.4" fill="none" />
        </G>
      ) : null}
      {kind === "leaf" ? (
        <G>
          <Path d="M12 2 C20 6 21 15 12 22 C3 15 4 6 12 2 Z" fill={color} />
          <Path d="M12 4 L12 21" stroke="#ffffff" strokeWidth="1" opacity={0.45} />
        </G>
      ) : null}
    </Svg>
  );
}

// ── On the logo ────────────────────────────────────────────────────────────
export function LogoAccessory({ season, height, width }: { season: string; height: number; width: number }) {
  const h = height * 0.62;
  const w = h * (64 / 52);
  const topLeft = { position: "absolute" as const, left: -height * 0.12, top: -height * 0.3, transform: [{ rotate: "-14deg" }] };

  if (season === "christmas") {
    return (
      <Svg width={w} height={h} viewBox="0 0 64 52" style={topLeft}>
        <Path d="M6 40 C8 18 24 4 46 6 C40 12 38 20 44 30 C48 36 52 40 56 42 Z" fill="#d6262c" />
        <Path d="M6 40 C8 18 24 4 46 6 C42 9 38 14 36 20 C26 22 14 30 6 40 Z" fill="#ee4a4a" opacity={0.55} />
        <Path d="M3 41 C20 37 42 38 60 45 C61 49 58 51 55 50 C40 45 20 44 6 48 C3 49 1 45 3 41 Z" fill="#ffffff" />
        <Circle cx="47" cy="6" r="6" fill="#ffffff" />
      </Svg>
    );
  }
  if (season === "halloween") {
    return (
      <Svg width={w} height={h} viewBox="0 0 64 52" style={topLeft}>
        <Path d="M8 42 C14 30 22 14 40 4 C38 16 42 28 56 42 Z" fill="#1c1b22" />
        <Path d="M10 36 C26 32 42 32 54 38 L56 42 L8 42 Z" fill="#7b3fb0" />
        <Rect x="28" y="33" width="10" height="9" rx="1.5" fill="none" stroke="#f1c40f" strokeWidth="2" />
        <Ellipse cx="32" cy="45" rx="30" ry="5" fill="#1c1b22" />
      </Svg>
    );
  }
  if (season === "easter") {
    return (
      <Svg width={w} height={h * 1.1} viewBox="0 0 64 56" style={{ position: "absolute", left: height * 0.1, top: -height * 0.5 }}>
        <Ellipse cx="22" cy="26" rx="8" ry="22" fill="#ffffff" transform="rotate(-12 22 26)" />
        <Ellipse cx="22" cy="28" rx="3.8" ry="16" fill="#ffb3c7" transform="rotate(-12 22 28)" />
        <Ellipse cx="44" cy="26" rx="8" ry="22" fill="#ffffff" transform="rotate(14 44 26)" />
        <Ellipse cx="44" cy="28" rx="3.8" ry="16" fill="#ffb3c7" transform="rotate(14 44 28)" />
      </Svg>
    );
  }
  if (season === "valentines") {
    return (
      <Svg width={h * 0.9} height={h * 0.9} viewBox="0 0 24 24" style={{ position: "absolute", left: -height * 0.05, top: -height * 0.22, transform: [{ rotate: "-16deg" }] }}>
        <Path d="M12 21 C4 14 2 9 2 6.5 C2 3.5 4.5 2 7 2 C9 2 11 3.3 12 5 C13 3.3 15 2 17 2 C19.5 2 22 3.5 22 6.5 C22 9 20 14 12 21 Z" fill="#ff2e63" />
        <Path d="M7 6 C8 5 9.5 5.2 10 6.4" stroke="#ffffff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={0.7} />
      </Svg>
    );
  }
  if (season === "stpatricks") {
    return (
      <View style={{ position: "absolute", left: -height * 0.08, top: -height * 0.3 }}>
        <Sprite kind="shamrock" size={h * 0.95} color="#1fa84f" />
        <View style={{ position: "absolute", left: h * 0.8, top: h * 0.5 }}>
          <Svg width={h * 0.45} height={h * 0.45} viewBox="0 0 20 20">
            <Circle cx="10" cy="10" r="9" fill="#f1c40f" stroke="#c99a06" strokeWidth="1.2" />
            <Circle cx="10" cy="10" r="5.5" fill="none" stroke="#c99a06" strokeWidth="1" />
          </Svg>
        </View>
      </View>
    );
  }
  if (season === "autumn") {
    return (
      <View style={{ position: "absolute", left: -height * 0.04, top: -height * 0.24, transform: [{ rotate: "-20deg" }] }}>
        <Sprite kind="leaf" size={h * 0.95} color="#e07a1f" />
      </View>
    );
  }
  if (season === "summer") {
    const s = h * 0.9;
    return (
      <View style={{ position: "absolute", left: width - s * 0.62, top: -height * 0.34 }}>
        <Svg width={s} height={s} viewBox="-12 -12 24 24">
          <Circle r="5" fill="#ffd23f" />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <Line key={i} x1={Math.cos(a) * 7} y1={Math.sin(a) * 7} x2={Math.cos(a) * 10.5} y2={Math.sin(a) * 10.5} stroke="#ffd23f" strokeWidth="2" strokeLinecap="round" />;
          })}
        </Svg>
      </View>
    );
  }
  return null;
}

// ── On the top edge of a card ──────────────────────────────────────────────
export function CardTopDecor({ season, seed }: { season: string; seed: number }) {
  const shift = (seed * 37) % 60;
  if (season === "christmas") {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 22" preserveAspectRatio="none">
        <Path
          d={`M0 12 C20 3 ${50 + shift} 2 ${90 + shift} 7 C${130 + shift} 1 ${170 + shift} 2 ${210 + shift} 6 C${250 + shift} 0 300 3 340 6 C370 4 392 8 400 12 L400 14 C390 12 380 15 370 14 C365 20 355 20 352 14 C300 16 ${270 + shift} 13 ${230 + shift} 15 C${224 + shift} 21 ${214 + shift} 21 ${210 + shift} 15 C170 15 130 13 100 15 C94 20 84 20 80 14 C50 14 20 15 0 14 Z`}
          fill="#f7faff"
        />
        <Path d="M0 12 C20 3 70 2 120 8" stroke="#dce8f7" strokeWidth="1.2" fill="none" opacity={0.7} />
        <Circle cx={Math.round(60 + shift)} cy="16" r="3" fill="#f7faff" />
        <Circle cx={Math.round(280 + shift / 2)} cy="16" r="2.6" fill="#f7faff" />
      </Svg>
    );
  }
  return null;
}

/** Small drawings that sit on a card's top edge (hearts, shamrocks, eggs, leaves) or hang from it (Halloween spiders). */
export function CardEdgeSprites({ season, seed }: { season: string; seed: number }) {
  const kinds: Record<string, SpriteKind> = { valentines: "heart", stpatricks: "shamrock", easter: "egg", autumn: "leaf" };
  const kind = kinds[season];
  if (kind) {
    const colours = SPRITE_COLOURS[kind];
    return (
      <>
        {[0, 1, 2].map((i) => {
          const left = `${12 + ((seed * 13 + i * 31) % 70)}%` as const;
          const size = 15 + ((seed + i * 5) % 8);
          return (
            <View key={i} style={{ position: "absolute", left, top: -size + 5, transform: [{ rotate: `${((seed + i * 4) % 5) * 9 - 18}deg` }] }}>
              <Sprite kind={kind} size={size} color={colours[(seed + i) % colours.length]} />
            </View>
          );
        })}
      </>
    );
  }
  if (season === "halloween") {
    const left = `${18 + ((seed * 19) % 55)}%` as const;
    return (
      <>
        <View style={{ position: "absolute", right: 4, top: -4 }}>
          <Cobweb size={34} />
        </View>
        <Spider left={left} drop={18 + (seed % 3) * 6} />
      </>
    );
  }
  return null;
}

// ── Halloween ──────────────────────────────────────────────────────────────
export function Cobweb({ size, flip = false }: { size: number; flip?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <G stroke="#e8e8f0" strokeWidth="1" opacity={0.75} fill="none">
        <Line x1="0" y1="0" x2="40" y2="0" />
        <Line x1="0" y1="0" x2="0" y2="40" />
        <Line x1="0" y1="0" x2="34" y2="34" />
        <Line x1="0" y1="0" x2="40" y2="16" />
        <Line x1="0" y1="0" x2="16" y2="40" />
        <Path d="M8 0 Q8 8 0 8" />
        <Path d="M16 0 Q15 15 0 16" />
        <Path d="M24 0 Q22 22 0 24" />
        <Path d="M32 0 Q29 29 0 32" />
      </G>
    </Svg>
  );
}

export function Spider({ left, drop }: { left: `${number}%`; drop: number }) {
  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  return (
    <Animated.View style={{ position: "absolute", left, top: 0, alignItems: "center", transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }}>
      <View style={{ width: 1, height: drop, backgroundColor: "#d9d9e6", opacity: 0.8 }} />
      <Svg width={14} height={12} viewBox="0 0 14 12">
        <Ellipse cx="7" cy="7" rx="3.4" ry="3.6" fill="#1c1b22" />
        <Circle cx="7" cy="3.4" r="2" fill="#1c1b22" />
        <G stroke="#1c1b22" strokeWidth="1" fill="none" strokeLinecap="round">
          <Path d="M4 5 L1 3 M4 7 L0.5 7.5 M4.5 9 L2 11.5 M10 5 L13 3 M10 7 L13.5 7.5 M9.5 9 L12 11.5" />
        </G>
      </Svg>
    </Animated.View>
  );
}

// ── Summer ─────────────────────────────────────────────────────────────────
export function SummerSun() {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View style={{ position: "absolute", top: 36, right: -26, opacity: 0.9, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <Svg width={110} height={110} viewBox="-30 -30 60 60">
        <Circle r="13" fill="#ffd23f" />
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return <Line key={i} x1={Math.cos(a) * 18} y1={Math.sin(a) * 18} x2={Math.cos(a) * 27} y2={Math.sin(a) * 27} stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />;
        })}
      </Svg>
    </Animated.View>
  );
}

// ── The ground along the bottom of the screen ──────────────────────────────
export function Ground({ season }: { season: string }) {
  if (season === "christmas") {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 30" preserveAspectRatio="none">
        <Path d="M0 30 L0 15 C30 6 60 18 100 12 C140 6 170 18 210 12 C250 6 280 18 320 12 C350 8 380 14 400 16 L400 30 Z" fill="#f4f8ff" />
        <Path d="M0 30 L0 23 C40 19 80 26 130 22 C180 18 230 26 280 22 C330 18 370 24 400 24 L400 30 Z" fill="#dce8f7" />
      </Svg>
    );
  }
  if (season === "summer") {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 30" preserveAspectRatio="none">
        <Path d="M0 30 L0 10 C40 4 80 14 130 8 C180 2 230 14 280 8 C330 3 370 10 400 8 L400 30 Z" fill="#48c1ee" opacity={0.9} />
        <Path d="M0 30 L0 19 C50 14 90 22 140 18 C190 14 240 22 290 18 C340 14 380 20 400 18 L400 30 Z" fill="#f2d7a0" />
        <Path d="M0 30 L0 25 C60 22 120 28 200 25 C280 22 340 27 400 25 L400 30 Z" fill="#e8c070" />
      </Svg>
    );
  }
  if (season === "autumn") {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 30" preserveAspectRatio="none">
        <Path d="M0 30 L0 14 C40 8 70 18 120 12 C170 6 210 18 260 12 C310 7 350 16 400 12 L400 30 Z" fill="#a0521d" />
        <Path d="M0 30 L0 22 C60 17 110 26 180 21 C250 16 330 26 400 21 L400 30 Z" fill="#7a3d14" />
        <Circle cx="50" cy="13" r="4" fill="#e07a1f" />
        <Circle cx="130" cy="10" r="3.5" fill="#f1c40f" />
        <Circle cx="215" cy="12" r="4" fill="#c0392b" />
        <Circle cx="300" cy="10" r="3.5" fill="#e07a1f" />
        <Circle cx="365" cy="13" r="4" fill="#f1c40f" />
      </Svg>
    );
  }
  return null;
}
