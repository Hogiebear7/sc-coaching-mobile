import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CommentSheet } from "@/components/ui/CommentSheet";
import { Color, Spacing } from "@/constants/theme";
import { formatCommunityDate, formatPbExerciseName, formatWorkoutTitle } from "@/lib/community-formatters";
import { tapFeedback } from "@/lib/haptics";
import { useCommunityWorkoutItem, useToggleWorkoutLike } from "@/lib/queries/community";
import { formatExerciseLoad, formatRun } from "@/lib/workout-formatters";

// Deep-link target for community notifications (a like, a comment, a
// mention) — opens straight to the specific workout that prompted the
// notification, comments already open, rather than dropping the member at
// the Community root to go hunting for it.
export default function CommunityWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isLoading, isError } = useCommunityWorkoutItem(id ?? "");
  const toggleLike = useToggleWorkoutLike();
  const [commentsOpen, setCommentsOpen] = useState(true);
  const pbExerciseName = item?.isPersonalBest ? formatPbExerciseName(item.personalBestExercise) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout</Text>
        <View style={{ width: 22 }} />
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
                <Ionicons name="trophy-outline" size={12} color={Color.gold} />
                <Text style={styles.pbBadgeText}>
                  {pbExerciseName ? `New ${pbExerciseName} PB` : "New PB"}
                </Text>
              </View>
            ) : null}
            {item.exercises.map((ex, i) => (
              <Text key={`ex-${i}`} style={styles.line} numberOfLines={1}>
                {ex.name.trim() || "Exercise"} — {formatExerciseLoad(ex) || "logged"}
              </Text>
            ))}
            {item.runs.map((run, i) => (
              <Text key={`run-${i}`} style={styles.line}>
                Run — {formatRun(run)}
              </Text>
            ))}

            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  tapFeedback();
                  toggleLike.mutate(item.id);
                }}
                disabled={toggleLike.isPending}
                style={[styles.actionButton, toggleLike.isPending && styles.actionButtonPending]}
                hitSlop={8}
                accessibilityLabel={item.likedByMe ? "Unlike this workout" : "Like this workout"}
              >
                <Ionicons
                  name={item.likedByMe ? "heart" : "heart-outline"}
                  size={17}
                  color={item.likedByMe ? Color.textSecondary : Color.textFaint}
                />
                {item.likeCount > 0 ? <Text style={styles.actionText}>{item.likeCount}</Text> : null}
              </Pressable>
              <Pressable
                onPress={() => setCommentsOpen(true)}
                style={styles.actionButton}
                hitSlop={8}
                accessibilityLabel="View comments"
              >
                <Ionicons name="chatbubble-outline" size={16} color={Color.textFaint} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { color: Color.textMuted, fontSize: 14 },
  body: { paddingHorizontal: Spacing.lg },
  card: { padding: Spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  authorName: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  date: { fontSize: 11, color: Color.textFaint },
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
    backgroundColor: Color.goldWeak,
  },
  pbBadgeText: { fontSize: 10, fontWeight: "700", color: Color.gold },
  line: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, paddingVertical: 4 },
  actionButtonPending: { opacity: 0.5 },
  actionText: { fontSize: 12, fontWeight: "500", color: Color.textFaint },
  actionError: { fontSize: 11, color: Color.danger, marginLeft: "auto" },
});
