import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

// Computes the next unused "ST<n>" label given the groups already assigned
// in scope, so "+ New" always offers the next free slot.
function nextSupersetLabel(groups: (string | null)[]): string {
  let max = 0;
  for (const g of groups) {
    const match = g?.match(/^ST(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `ST${max + 1}`;
}

// Chip row for assigning an exercise to a superset group shared with other
// exercises in scope (a workout session, a program day, a template) —
// tapping "+ New" mints the next free "ST<n>" label. `allGroups` is just the
// `supersetGroup` value of every row in the same scope, so callers with
// different row shapes can all pass `rows.map(r => r.supersetGroup)`.
export function SupersetChips({
  value,
  allGroups,
  onChange,
}: {
  value: string | null;
  allGroups: (string | null)[];
  onChange: (v: string | null) => void;
}) {
  const existingGroups = Array.from(new Set(allGroups.filter((g): g is string => !!g)));
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(null)} style={[styles.chip, value === null && styles.chipActive]}>
        <Text style={[styles.chipText, value === null && styles.chipTextActive]}>None</Text>
      </Pressable>
      {existingGroups.map((group) => (
        <Pressable
          key={group}
          onPress={() => onChange(group)}
          style={[styles.chip, value === group && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === group && styles.chipTextActive]}>{group}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => onChange(nextSupersetLabel(allGroups))} style={styles.chip}>
        <Text style={styles.chipText}>+ New</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  chipTextActive: { color: Color.gold },
});
