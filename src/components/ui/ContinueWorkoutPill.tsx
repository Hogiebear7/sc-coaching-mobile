import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import { useWorkoutDraft } from "@/lib/workout-draft";

/**
 * Jump straight back into an in-progress workout from anywhere in the app —
 * mirrors the Workouts tab's own header pill, so a member doesn't have to
 * navigate back to that tab first to resume. Renders nothing when there's
 * no active draft.
 */
export function ContinueWorkoutPill() {
  const router = useRouter();
  const { hasContent } = useWorkoutDraft();

  if (!hasContent) return null;

  return (
    <Pressable onPress={() => router.push("/log-workout")} style={styles.pill}>
      <Ionicons name="play" size={18} color={Color.goldForeground} />
      <Text style={styles.pillText}>Continue</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Color.gold,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  pillText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
});
