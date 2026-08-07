import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Color, Spacing } from "@/constants/theme";

// Placeholder for tabs not yet built out (Phase 1 of the 12-day plan) —
// keeps the tab navigable and on-brand rather than a blank/crashing screen.
export function ComingSoon({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>This tab is being built next — check back soon.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Color.textPrimary,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: 13,
    color: Color.textMuted,
    textAlign: "center",
  },
});
