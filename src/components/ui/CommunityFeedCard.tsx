import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LikeButton } from "@/components/app/LikeButton";
import { ExercisePreviewList } from "@/components/ui/ExercisePreviewList";
import { Radius, Spacing } from "@/constants/theme";
import { formatCommunityDate, formatWorkoutTitle } from "@/lib/community-formatters";
import { tapFeedback } from "@/lib/haptics";
import { useToggleWorkoutLike, type CommunityFeedItem } from "@/lib/queries/community";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// Shared between the Community hub's own capped Activity preview (see
// community.tsx) and the full /community/activity list — same card, same
// like/comment behavior, so an activity item looks and behaves identically
// wherever it's shown. The exercise rows are the same ExercisePreviewList
// the History screen uses, so a workout reads the same everywhere.
export function CommunityFeedCard({ item, onOpenComments }: { item: CommunityFeedItem; onOpenComments: () => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const toggleLike = useToggleWorkoutLike();
  const isLiking = toggleLike.isPending && toggleLike.variables === item.id;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(item.authorName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>
            {item.authorName.replace(/\s+/g, " ")}
          </Text>
          <Text style={styles.date}>{formatCommunityDate(item.date, "compact")}</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {formatWorkoutTitle(item.title)}
        </Text>
        {/* Same trophy language as Community Wins, so a card that's ALSO
            the session where a PB happened reads as "this one is
            notable," not as an unexplained duplicate of that section. */}
        {item.isPersonalBest ? (
          <View style={styles.pbBadge}>
            <Ionicons name="trophy" size={12} color={Color.brand} />
            <Text style={styles.pbBadgeText}>PB</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <ExercisePreviewList exercises={item.exercises} runs={item.runs} />
      </View>

      <View style={styles.actions}>
        <LikeButton
          liked={item.likedByMe}
          count={item.likeCount}
          disabled={isLiking}
          onToggle={() => toggleLike.mutate(item.id)}
        />
        <Pressable
          onPress={() => {
            tapFeedback();
            onOpenComments();
          }}
          style={styles.actionButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={item.commentCount > 0 ? `View ${item.commentCount} comments` : "Add a comment"}
        >
          <Ionicons name="chatbubble-outline" size={19} color={Color.textMuted} />
          {item.commentCount > 0 ? <Text style={styles.actionText}>{item.commentCount}</Text> : null}
        </Pressable>
        {toggleLike.isError ? <Text style={styles.actionError}>Couldn&apos;t update — try again</Text> : null}
      </View>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 13, fontWeight: "700", color: Color.textSecondary },
    authorName: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
    date: { fontSize: 13, color: Color.textMuted, marginTop: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
    title: { fontSize: 17, fontWeight: "600", color: Color.textPrimary, flexShrink: 1 },
    pbBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.pill, backgroundColor: Color.surface2, paddingHorizontal: 8, paddingVertical: 3 },
    pbBadgeText: { fontSize: 12, fontWeight: "700", color: Color.textPrimary },
    body: { marginTop: 12 },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.lg,
      marginTop: 12,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color.borderSubtle,
    },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
    actionText: { fontSize: 15, fontWeight: "500", color: Color.textMuted },
    actionError: { fontSize: 13, color: Color.danger, marginLeft: "auto" },
  })
);
