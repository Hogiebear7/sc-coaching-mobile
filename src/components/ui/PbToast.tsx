import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import { successFeedback } from "@/lib/haptics";

const AUTO_DISMISS_MS = 3500;

/**
 * A brief celebratory banner for a live PB during a workout — pinned near
 * the top of the screen so it never collides with the RestTimerBar at the
 * bottom. Auto-dismisses after AUTO_DISMISS_MS; also dismissible by tap.
 */
export function PbToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  // Read via ref rather than depending on `onDismiss` directly — this
  // screen re-renders every second while a live workout timer is running,
  // which would otherwise hand the effect a new function identity each
  // time and keep resetting the auto-dismiss countdown indefinitely.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!message) return;
    successFeedback();
    const id = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [message]);

  if (!message) return null;

  return (
    <Pressable onPress={onDismiss} style={styles.toast}>
      <Ionicons name="trophy" size={16} color={Color.bg0} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Color.gold,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    zIndex: 20,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1, fontSize: 13, fontWeight: "700", color: Color.bg0 },
});
