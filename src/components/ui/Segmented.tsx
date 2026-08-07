import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius } from "@/constants/theme";

// RN port of the web app's inline Segmented control (NutritionView.tsx).
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable key={String(opt)} onPress={() => onChange(opt)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {format(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: 2,
  },
  segment: { flex: 1, borderRadius: Radius.sm, paddingVertical: 8, alignItems: "center" },
  segmentActive: { backgroundColor: Color.surface3 },
  segmentText: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  segmentTextActive: { color: Color.textPrimary },
});
