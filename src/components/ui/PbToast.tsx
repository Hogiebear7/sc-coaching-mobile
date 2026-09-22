import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback } from "@/lib/haptics";

const VISIBLE_MS = 5000;
const FADE_MS = 400;
// Clears RestTimerBar's own height (its content + top padding + the
// device's bottom safe-area inset, which this adds on top of separately)
// plus a small gap — a live PB is typically hit in the same tap that also
// starts a rest, so the two are very likely on screen at the same time.
const BOTTOM_CLEARANCE = 70;

/**
 * A brief celebratory banner for a live PB during a workout — pinned near
 * the bottom of the screen, above where RestTimerBar sits when a rest is
 * running. Fades in, holds for VISIBLE_MS, fades out; also dismissible by
 * tap.
 */
export function PbToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  // Read via ref rather than depending on `onDismiss` directly — this
  // screen re-renders every second while a live workout timer is running,
  // which would otherwise hand the effect a new function identity each
  // time and keep resetting the auto-dismiss countdown indefinitely.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  function fadeOutAndDismiss() {
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDismissRef.current();
    });
  }

  useEffect(() => {
    if (!message) return;
    successFeedback();
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    const id = setTimeout(fadeOutAndDismiss, VISIBLE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + BOTTOM_CLEARANCE, opacity }]}
    >
      <Pressable onPress={fadeOutAndDismiss} style={styles.toast}>
        <Ionicons name="trophy" size={16} color={Color.bg0} />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 20,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Color.gold,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1, fontSize: 13, fontWeight: "700", color: Color.bg0 },
});
