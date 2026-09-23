import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Spacing } from "@/constants/theme";
import { formatCommunityDate, formatPbHeadline } from "@/lib/community-formatters";

// Minimal shape either CommunityFeedItem or the dedicated wins endpoint's
// CommunityWinEntry satisfies — this row only ever needs these four fields,
// so it doesn't force callers into one specific query's response type.
export interface WinLike {
  id: string;
  authorName: string;
  date: string;
  personalBestExercise: string | null;
}

// Shared between the Community hub's own "Community Wins" preview (capped,
// see community.tsx) and the full /community/wins list — same row, same
// tap behavior (open that session's comments in place), so a win looks and
// behaves identically wherever it's shown.
export function CommunityWinRow({ item, isLast, onPress }: { item: WinLike; isLast: boolean; onPress: () => void }) {
  const headline = formatPbHeadline(item.authorName, item.personalBestExercise);
  return (
    <Pressable onPress={onPress} style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.icon}>
        <Ionicons name="trophy-outline" size={16} color={Color.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>
          <Text style={styles.author}>{headline.author}</Text> {headline.rest}
        </Text>
        <Text style={styles.date}>{formatCommunityDate(item.date, "short")}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: Color.borderSubtle },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: 13, color: Color.textSecondary, lineHeight: 18 },
  author: { fontWeight: "700", color: Color.textPrimary },
  date: { fontSize: 11, color: Color.textFaint, marginTop: 2 },
});
