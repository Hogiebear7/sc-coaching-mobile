import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { CommentSheet } from "@/components/ui/CommentSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemberSearchSheet } from "@/components/ui/MemberSearchSheet";
import { Segmented } from "@/components/ui/Segmented";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import {
  useCommunityFeed,
  useLeaderboard,
  useToggleWorkoutLike,
  type CommunityFeedItem,
  type LeaderboardMetric,
} from "@/lib/queries/community";
import { formatExerciseLoad, formatRun } from "@/lib/workout-formatters";

const LEADERBOARD_METRICS: LeaderboardMetric[] = ["volume", "squat", "bench", "deadlift"];
const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  volume: "Volume",
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
};

function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const MAX_PREVIEW_LINES = 3;

function FeedCard({ item, onOpenComments }: { item: CommunityFeedItem; onOpenComments: () => void }) {
  const toggleLike = useToggleWorkoutLike();
  const previewExercises = item.exercises.slice(0, MAX_PREVIEW_LINES);
  const remainingSlots = Math.max(0, MAX_PREVIEW_LINES - previewExercises.length);
  const previewRuns = item.runs.slice(0, remainingSlots);
  const hiddenCount = item.exercises.length + item.runs.length - previewExercises.length - previewRuns.length;

  return (
    <Card style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <Text style={styles.authorName}>{item.authorName}</Text>
        <Text style={styles.feedDate}>{formatDate(item.date)}</Text>
      </View>
      <Text style={styles.feedTitle}>{item.title}</Text>
      {previewExercises.map((ex, i) => (
        <Text key={`ex-${i}`} style={styles.feedLine} numberOfLines={1}>
          {ex.name} — {formatExerciseLoad(ex) || "logged"}
        </Text>
      ))}
      {previewRuns.map((run, i) => (
        <Text key={`run-${i}`} style={styles.feedLine} numberOfLines={1}>
          Run — {formatRun(run)}
        </Text>
      ))}
      {hiddenCount > 0 ? <Text style={styles.feedMore}>+{hiddenCount} more</Text> : null}

      <View style={styles.feedActions}>
        <Pressable
          onPress={() => {
            tapFeedback();
            toggleLike.mutate(item.id);
          }}
          style={styles.feedActionButton}
          hitSlop={8}
        >
          <Ionicons
            name={item.likedByMe ? "heart" : "heart-outline"}
            size={18}
            color={item.likedByMe ? Color.gold : Color.textMuted}
          />
          <Text style={styles.feedActionText}>{item.likeCount}</Text>
        </Pressable>
        <Pressable onPress={onOpenComments} style={styles.feedActionButton} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={16} color={Color.textMuted} />
          <Text style={styles.feedActionText}>{item.commentCount}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function CommunityScreen() {
  const [tab, setTab] = useState<"feed" | "leaderboard">("feed");
  const [metric, setMetric] = useState<LeaderboardMetric>("volume");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<CommunityFeedItem | null>(null);

  const feed = useCommunityFeed();
  const leaderboard = useLeaderboard(metric);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={Color.gold} />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Community</Text>
          <Pressable onPress={() => setSearchOpen(true)} style={styles.findButton}>
            <Ionicons name="person-add-outline" size={16} color={Color.goldForeground} />
            <Text style={styles.findButtonText}>Find people</Text>
          </Pressable>
        </View>

        <Segmented
          options={["feed", "leaderboard"] as const}
          value={tab}
          onChange={setTab}
          format={(v) => (v === "feed" ? "Feed" : "Leaderboard")}
        />

        {tab === "feed" ? (
          <View style={styles.section}>
            {feed.isLoading ? (
              <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.xl }} />
            ) : !feed.data || feed.data.items.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No activity yet"
                body="Follow other members to see their workouts here."
                actionLabel="Find people"
                onAction={() => setSearchOpen(true)}
                style={{ marginTop: Spacing.lg }}
              />
            ) : (
              feed.data.items.map((item) => (
                <FeedCard key={item.id} item={item} onOpenComments={() => setActiveItem(item)} />
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.metricRow}>
              {LEADERBOARD_METRICS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMetric(m)}
                  style={[styles.metricChip, metric === m && styles.metricChipActive]}
                >
                  <Text style={[styles.metricChipText, metric === m && styles.metricChipTextActive]}>
                    {METRIC_LABEL[m]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {leaderboard.isLoading ? (
              <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.xl }} />
            ) : !leaderboard.data || leaderboard.data.entries.length === 0 ? (
              <EmptyState
                icon="trophy-outline"
                title="No entries yet"
                body="Log a workout to appear on this leaderboard."
                style={{ marginTop: Spacing.lg }}
              />
            ) : (
              <Card style={styles.leaderboardCard}>
                {leaderboard.data.entries.map((entry, i) => {
                  const isMe = entry.userId === leaderboard.data!.myUserId;
                  return (
                    <View key={entry.userId} style={[styles.leaderboardRow, i > 0 && styles.leaderboardRowDivider]}>
                      <Text style={[styles.leaderboardRank, isMe && styles.leaderboardTextMe]}>{i + 1}</Text>
                      <Text style={[styles.leaderboardName, isMe && styles.leaderboardTextMe]} numberOfLines={1}>
                        {isMe ? "You" : entry.displayName}
                      </Text>
                      <View style={styles.leaderboardValueWrap}>
                        <Text style={[styles.leaderboardValue, isMe && styles.leaderboardTextMe]}>
                          {Math.round(entry.value).toLocaleString()} kg
                        </Text>
                        {entry.bodyweightPct !== null ? (
                          <Text style={styles.leaderboardPct}>{entry.bodyweightPct}% BW</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      <MemberSearchSheet visible={searchOpen} onClose={() => setSearchOpen(false)} mode="follow" />
      <CommentSheet
        visible={activeItem !== null}
        onClose={() => setActiveItem(null)}
        workoutSessionId={activeItem?.id ?? ""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heading: { fontSize: 24, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  findButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Color.gold,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  findButtonText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
  section: { marginTop: Spacing.lg },
  feedCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  feedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  authorName: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  feedDate: { fontSize: 11, color: Color.textFaint },
  feedTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, marginTop: 4 },
  feedLine: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  feedMore: { fontSize: 11, color: Color.textFaint, marginTop: 2 },
  feedActions: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  feedActionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  feedActionText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  metricRow: { flexDirection: "row", gap: 6, marginBottom: Spacing.md },
  metricChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingVertical: 8,
  },
  metricChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  metricChipText: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  metricChipTextActive: { color: Color.gold },
  leaderboardCard: { padding: 0, overflow: "hidden" },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  leaderboardRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  leaderboardRank: { fontSize: 13, fontWeight: "700", color: Color.textFaint, width: 20 },
  leaderboardName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, flex: 1 },
  leaderboardValueWrap: { alignItems: "flex-end" },
  leaderboardValue: { fontSize: 13, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  leaderboardPct: { fontSize: 10, color: Color.textFaint, marginTop: 1 },
  leaderboardTextMe: { color: Color.gold },
});
