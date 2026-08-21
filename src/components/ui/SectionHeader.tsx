import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Spacing } from "@/constants/theme";

// Every screen used to hand-roll this exact label + optional trailing-link
// row (small-caps muted label, gold "See all"/"Edit"/"Choose" text) with
// its own locally-duplicated style block — workouts.tsx alone had two
// near-identical copies under different names. One shared component means
// hierarchy/spacing changes land everywhere at once instead of drifting.
// `action` covers the common "See all"-style text link; `right` is an
// escape hatch for the rare non-text trailing element (a status chip).
export function SectionHeader({
  label,
  action,
  right,
}: {
  label: string;
  action?: { label: string; onPress: () => void };
  right?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : (
        right ?? null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
  },
  action: {
    fontSize: 12,
    fontWeight: "600",
    color: Color.gold,
  },
});
