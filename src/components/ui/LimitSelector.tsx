import { Pressable, StyleSheet, Text, View } from "react-native";

import { Radius } from "@/constants/theme";
import { makeLegacyStyles } from "@/lib/theme";

const OPTIONS = [20, 50, 100] as const;
export type ListLimit = (typeof OPTIONS)[number];

// Shared "how many to show" chip row for the full Community Wins / Activity
// list screens — same visual language as the leaderboard's metric/range
// chips on the Community hub.
export function LimitSelector({ value, onChange }: { value: ListLimit; onChange: (next: ListLimit) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {OPTIONS.map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} style={[styles.chip, value === n && styles.chipActive]}>
          <Text style={[styles.chipText, value === n && styles.chipTextActive]}>Last {n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 2,
      padding: 3,
      borderRadius: Radius.pill,
      backgroundColor: Color.overlayFaint,
    },
    chip: { flex: 1, alignItems: "center", borderRadius: Radius.pill, paddingVertical: 7, minHeight: 40, justifyContent: "center" },
    chipActive: { backgroundColor: Color.gold },
    chipText: { fontSize: 14, fontWeight: "600", color: Color.textFaint },
    chipTextActive: { color: Color.goldForeground, fontWeight: "700" },
  })
);
