import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { impactFeedback, tapFeedback } from "@/lib/haptics";
import { useLegacyColors } from "@/lib/theme";

// The like colour — a warm red that holds up on both the dark and light
// palettes. Only ever used for a liked heart and its count.
export const LIKE_RED = "#F5384F";

const PARTICLES = 7;
const PARTICLE_RADIUS = 20;
const SIZE = 20;

// Heart that pops and bursts when liked (the X/Twitter pattern): the heart
// springs up from small, a red ring expands and fades, and a few dots fly
// outward. Unliking just settles the heart back. Reduced-motion users get
// the colour change only.
export function LikeButton({
  liked,
  count,
  onToggle,
  disabled,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const Color = useLegacyColors();
  const [heartScale] = useState(() => new Animated.Value(1));
  const [burst] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  function handlePress() {
    if (!liked) {
      impactFeedback();
      if (!reduceMotion) {
        heartScale.setValue(0.2);
        burst.setValue(0);
        Animated.parallel([
          Animated.spring(heartScale, { toValue: 1, friction: 3, tension: 170, useNativeDriver: true }),
          Animated.timing(burst, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      }
    } else {
      tapFeedback();
      if (!reduceMotion) {
        heartScale.setValue(0.8);
        Animated.timing(heartScale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }
    }
    onToggle();
  }

  const ringStyle = {
    opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.7, 0] }),
    transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.9] }) }],
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      style={styles.button}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? "Unlike this workout" : "Like this workout"}
    >
      <View style={styles.heartBox}>
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        {Array.from({ length: PARTICLES }, (_, i) => {
          const angle = (i / PARTICLES) * Math.PI * 2 - Math.PI / 2;
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.particle,
                { backgroundColor: i % 2 === 0 ? LIKE_RED : "#FFB020" },
                {
                  opacity: burst.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * PARTICLE_RADIUS] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * PARTICLE_RADIUS] }) },
                    { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                  ],
                },
              ]}
            />
          );
        })}
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={SIZE} color={liked ? LIKE_RED : Color.textMuted} />
        </Animated.View>
      </View>
      {count > 0 ? <Text style={[styles.count, { color: liked ? LIKE_RED : Color.textMuted }]}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingRight: 4 },
  heartBox: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: LIKE_RED },
  particle: { position: "absolute", width: 5, height: 5, borderRadius: 2.5 },
  count: { fontSize: 15, fontWeight: "500", fontVariant: ["tabular-nums"] },
});
