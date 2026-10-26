import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { MemberSafetySheet } from "@/components/ui/MemberSafetySheet";
import { LikeButton } from "@/components/app/LikeButton";
import { Card } from "@/components/ui/Card";
import { CommentSheet } from "@/components/ui/CommentSheet";
import { ExercisePreviewList } from "@/components/ui/ExercisePreviewList";
import { Spacing } from "@/constants/theme";
import { formatCommunityDate, formatPbExerciseName, formatWorkoutTitle } from "@/lib/community-formatters";
import { useAuth } from "@/lib/auth-context";
import { tapFeedback } from "@/lib/haptics";
import { useCommunityWorkoutItem, useToggleWorkoutLike } from "@/lib/queries/community";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Deep-link target for community notifications (a like, a comment, a
// mention) — opens straight to the specific workout that prompted the
// notification, comments already open, rather than dropping the member at
// the Community root to go hunting for it.
export default function CommunityWorkoutScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isLoading, isError } = useCommunityWorkoutItem(id ?? "");
  const toggleLike = useToggleWorkoutLike();
  const [commentsOpen, setCommentsOpen] = useState(true);
  const { user } = useAuth();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const pbExerciseName = item?.isPersonalBest ? formatPbExerciseName(item.personalBestExercise) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout</Text>
        {item && item.userId !== user?.id ? (
          <Pressable
            onPress={() => setSafetyOpen(true)}
            hitSlop={12}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${item.authorName}`}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={Color.textMuted} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !item ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>Couldn&apos;t find that workout.</Text>
          <Button title="Back to Community" variant="secondary" onPress={() => router.replace("/community")} style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <View style={styles.body}>
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.authorName} numberOfLines={1}>
                {item.authorName}
              </Text>
              <Text style={styles.date}>{formatCommunityDate(item.date, "long")}</Text>
            </View>
            <Text style={styles.title}>{formatWorkoutTitle(item.title)}</Text>
            {item.isPersonalBest ? (
              <View style={styles.pbBadge}>
                <Ionicons name="trophy" size={12} color={Color.brand} />
                <Text style={styles.pbBadgeText}>
                  {pbExerciseName ? `New ${pbExerciseName} PB` : "New PB"}
                </Text>
              </View>
            ) : null}
            <View style={styles.exercises}>
              <ExercisePreviewList exercises={item.exercises} runs={item.runs} maxRows={50} />
            </View>

            <View style={styles.actions}>
              <LikeButton
                liked={item.likedByMe}
                count={item.likeCount}
                disabled={toggleLike.isPending}
                onToggle={() => toggleLike.mutate(item.id)}
              />
              <Pressable
                onPress={() => {
                  tapFeedback();
                  setCommentsOpen(true);
                }}
                style={styles.actionButton}
                hitSlop={8}
                accessibilityLabel="View comments"
              >
                <Ionicons name="chatbubble-outline" size={19} color={Color.textMuted} />
                {item.commentCount > 0 ? <Text style={styles.actionText}>{item.commentCount}</Text> : null}
              </Pressable>
              {toggleLike.isError ? <Text style={styles.actionError}>Couldn&apos;t update — try again</Text> : null}
            </View>
          </Card>

          <Button
            title="View Community"
            variant="secondary"
            onPress={() => router.push("/community")}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      )}

      {item ? (
        <CommentSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} workoutSessionId={item.id} />
      ) : null}
      {safetyOpen && item ? (
        <MemberSafetySheet
          visible
          onClose={() => setSafetyOpen(false)}
          memberUserId={item.userId}
          memberName={item.authorName}
          workoutId={item.id}
        />
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    emptyText: { color: Color.textMuted, fontSize: 14 },
    body: { paddingHorizontal: Spacing.lg },
    card: { padding: Spacing.md },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    authorName: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, flexShrink: 1 },
    date: { fontSize: 13, color: Color.textMuted },
    title: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginTop: 4 },
    pbBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      marginTop: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: Color.surface2,
    },
    pbBadgeText: { fontSize: 12, fontWeight: "700", color: Color.textPrimary },
    exercises: { marginTop: Spacing.md },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.lg,
      marginTop: Spacing.md,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color.borderSubtle,
    },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
    actionText: { fontSize: 15, fontWeight: "500", color: Color.textMuted },
    actionError: { fontSize: 13, color: Color.danger, marginLeft: "auto" },
  })
);
