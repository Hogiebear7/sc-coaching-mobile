import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Spacing } from "@/constants/theme";
import {
  challengeDisplayLabel,
  challengeStatusLabel,
  formatChallengeDates,
  sortChallenges,
} from "@/lib/community-groups-format";
import type { Challenge } from "@/lib/queries/community-groups";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// One row per challenge: title, what it is scored on, the dates, and whether it is live. Live ones are highlighted so they are the first thing seen.
export function ChallengeList({ challenges, onOpen }: { challenges: readonly Challenge[]; onOpen: (challenge: Challenge) => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const sorted = sortChallenges(challenges);

  return (
    <Card style={styles.card}>
      {sorted.map((c, i) => (
        <Pressable
          key={c.id}
          onPress={() => onOpen(c)}
          style={[styles.row, i > 0 && styles.rowDivider]}
          accessibilityRole="button"
          accessibilityLabel={`${c.title}, ${challengeStatusLabel(c.status)}`}
        >
          <View style={styles.main}>
            <Text style={styles.title} numberOfLines={1}>
              {c.title}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {challengeDisplayLabel(c)} · {formatChallengeDates(c.startDate, c.endDate)}
            </Text>
          </View>
          <View style={[styles.pill, c.status === "active" && styles.pillActive]}>
            <Text style={[styles.pillText, c.status === "active" && styles.pillTextActive]}>{challengeStatusLabel(c.status)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
        </Pressable>
      ))}
    </Card>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    card: { padding: 0, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 56 },
    rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    main: { flex: 1 },
    title: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
    sub: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Color.surface2 },
    pillActive: { backgroundColor: Color.gold },
    pillText: { fontSize: 12, fontWeight: "600", color: Color.textFaint },
    pillTextActive: { color: Color.goldForeground },
  })
);
