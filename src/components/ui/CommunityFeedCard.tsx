import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LikeButton } from "@/components/app/LikeButton";
import { ExercisePreviewList } from "@/components/ui/ExercisePreviewList";
import { MemberSafetySheet } from "@/components/ui/MemberSafetySheet";
import { Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { formatCommunityDate, formatWorkoutTitle } from "@/lib/community-formatters";
import { tapFeedback } from "@/lib/haptics";
import { useToggleWorkoutLike, type CommunityFeedItem } from "@/lib/queries/community";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { SnowBox } from "@/components/season/SnowBox";

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
  const { user } = useAuth();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const router = useRouter();

  return (
    <SnowBox style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            tapFeedback();
            router.push({ pathname: "/community/profile/[userId]", params: { userId: item.userId } });
          }}
          style={styles.authorTap}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.authorName}'s profile`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(item.authorName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName} numberOfLines={1}>
              {item.authorName.replace(/\s+/g, " ")}
            </Text>
            <Text style={styles.date}>{formatCommunityDate(item.date, "compact")}</Text>
          </View>
        </Pressable>
        {item.userId !== user?.id ? (
          <Pressable
            onPress={() => setSafetyOpen(true)}
            hitSlop={10}
            style={styles.moreButton}
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${item.authorName}`}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={Color.textMuted} />
          </Pressable>
        ) : null}
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

      {/* Tapping the exercises (or "+N more exercises") opens the full workout, with its sets, supersets and type, and a way to save it as a template. */}
      <Pressable
        onPress={() => {
          tapFeedback();
          router.push({ pathname: "/community/workout/[id]", params: { id: item.id, comments: "0" } });
        }}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={`View the full workout, ${formatWorkoutTitle(item.title)}`}
      >
        <ExercisePreviewList exercises={item.exercises} runs={item.runs} />
      </Pressable>

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
      {safetyOpen ? (
        <MemberSafetySheet
          visible
          onClose={() => setSafetyOpen(false)}
          memberUserId={item.userId}
          memberName={item.authorName}
          workoutId={item.id}
        />
      ) : null}
    </SnowBox>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    moreButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    authorTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
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
