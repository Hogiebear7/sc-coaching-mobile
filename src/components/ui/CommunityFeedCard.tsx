import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import { formatActivitySummary, formatCommunityDate, formatWorkoutTitle } from "@/lib/community-formatters";
import { tapFeedback } from "@/lib/haptics";
import { useToggleWorkoutLike, type CommunityFeedItem } from "@/lib/queries/community";

const MAX_PREVIEW_LINES = 3;

// Shared between the Community hub's own capped Activity preview (see
// community.tsx) and the full /community/activity list — same card, same
// like/comment behavior, so an activity item looks and behaves identically
// wherever it's shown.
export function CommunityFeedCard({ item, onOpenComments }: { item: CommunityFeedItem; onOpenComments: () => void }) {
  const toggleLike = useToggleWorkoutLike();
  const summary = formatActivitySummary(item.exercises, item.runs, MAX_PREVIEW_LINES);
  const isLiking = toggleLike.isPending && toggleLike.variables === item.id;

  return (
    <Card style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <Text style={styles.authorName} numberOfLines={1}>
          {item.authorName}
        </Text>
        <Text style={styles.feedDate}>{formatCommunityDate(item.date, "compact")}</Text>
      </View>
      <View style={styles.feedTitleRow}>
        <Text style={styles.feedTitle} numberOfLines={1}>
          {formatWorkoutTitle(item.title)}
        </Text>
        {/* Same trophy language as Community Wins, so a card that's ALSO
            the session where a PB happened reads as "this one is
            notable," not as an unexplained duplicate of that section. */}
        {item.isPersonalBest ? (
          <View style={styles.feedPbBadge}>
            <Ionicons name="trophy-outline" size={11} color={Color.gold} />
            <Text style={styles.feedPbBadgeText}>PB</Text>
          </View>
        ) : null}
      </View>
      {summary.lines.map((line, i) => (
        <Text key={i} style={styles.feedLine} numberOfLines={1}>
          {line}
        </Text>
      ))}
      {summary.hiddenCount > 0 ? <Text style={styles.feedMore}>+{summary.hiddenCount} more</Text> : null}

      {/* Deliberately quiet — small muted icons + counts, never gold, never
          the visual headline of the card. A nod, not a like-count to chase. */}
      <View style={styles.feedActions}>
        <Pressable
          onPress={() => {
            tapFeedback();
            toggleLike.mutate(item.id);
          }}
          disabled={isLiking}
          style={[styles.feedActionButton, isLiking && styles.feedActionButtonPending]}
          hitSlop={8}
          accessibilityLabel={item.likedByMe ? "Unlike this workout" : "Like this workout"}
        >
          <Ionicons
            name={item.likedByMe ? "heart" : "heart-outline"}
            size={16}
            color={item.likedByMe ? Color.textSecondary : Color.textFaint}
          />
          {item.likeCount > 0 ? <Text style={styles.feedActionText}>{item.likeCount}</Text> : null}
        </Pressable>
        <Pressable
          onPress={onOpenComments}
          style={styles.feedActionButton}
          hitSlop={8}
          accessibilityLabel="View comments"
        >
          <Ionicons name="chatbubble-outline" size={15} color={Color.textFaint} />
          {item.commentCount > 0 ? <Text style={styles.feedActionText}>{item.commentCount}</Text> : null}
        </Pressable>
        {toggleLike.isError ? <Text style={styles.feedActionError}>Couldn&apos;t update — try again</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  feedCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  feedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: Spacing.sm },
  authorName: { fontSize: 13, fontWeight: "700", color: Color.textPrimary, flexShrink: 1 },
  feedDate: { fontSize: 11, color: Color.textFaint },
  feedTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: 4 },
  feedTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, flexShrink: 1 },
  feedPbBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  feedPbBadgeText: { fontSize: 10, fontWeight: "700", color: Color.gold },
  feedLine: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  feedMore: { fontSize: 11, color: Color.textFaint, marginTop: 2 },
  feedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  feedActionButton: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, paddingVertical: 4 },
  feedActionButtonPending: { opacity: 0.5 },
  feedActionText: { fontSize: 11, fontWeight: "500", color: Color.textFaint },
  feedActionError: { fontSize: 11, color: Color.danger, marginLeft: "auto" },
});
