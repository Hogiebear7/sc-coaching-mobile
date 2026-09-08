import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CommentSheet } from "@/components/ui/CommentSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemberSearchSheet } from "@/components/ui/MemberSearchSheet";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { tapFeedback } from "@/lib/haptics";
import {
  useCommunityFeed,
  useFollowUser,
  useLeaderboard,
  useSuggestedMembers,
  useToggleWorkoutLike,
  type CommunityFeedItem,
  type LeaderboardMetric,
} from "@/lib/queries/community";
import { formatExerciseLoad, formatRun } from "@/lib/workout-formatters";

// Emphasis order, top to bottom: wins/milestones, leaderboards, supporting
// feed activity — comments/likes/mentions stay a tap away (the per-item
// sheet), never inline counters competing for attention. There's no
// "challenges" or "coach announcements" section — those aren't backend
// concepts yet (see lib/community-highlight.ts); this page's job is to
// present what actually exists with real hierarchy, not fabricate more.

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
const MAX_WINS = 5;

function WinRow({ item, isLast, onPress }: { item: CommunityFeedItem; isLast: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.winRow, !isLast && styles.winRowDivider]}>
      <View style={styles.winIcon}>
        <Ionicons name="trophy-outline" size={16} color={Color.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.winText}>
          <Text style={styles.winAuthor}>{item.authorName}</Text> hit a new {item.personalBestExercise} PB
        </Text>
        <Text style={styles.winDate}>{formatDate(item.date)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
    </Pressable>
  );
}

function SuggestedMemberRow({
  fullName,
  isLast,
  onFollow,
  pending,
}: {
  fullName: string;
  isLast: boolean;
  onFollow: () => void;
  pending: boolean;
}) {
  return (
    <View style={[styles.suggestedRow, !isLast && styles.suggestedRowDivider]}>
      <Text style={styles.suggestedName} numberOfLines={1}>
        {fullName}
      </Text>
      <Button title="Follow" onPress={onFollow} loading={pending} style={styles.suggestedFollowButton} />
    </View>
  );
}

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

      {/* Deliberately quiet — small muted icons + counts, never gold, never
          the visual headline of the card. A nod, not a like-count to chase. */}
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
            size={16}
            color={item.likedByMe ? Color.textSecondary : Color.textFaint}
          />
          {item.likeCount > 0 ? <Text style={styles.feedActionText}>{item.likeCount}</Text> : null}
        </Pressable>
        <Pressable onPress={onOpenComments} style={styles.feedActionButton} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={15} color={Color.textFaint} />
          {item.commentCount > 0 ? <Text style={styles.feedActionText}>{item.commentCount}</Text> : null}
        </Pressable>
      </View>
    </Card>
  );
}

const DISCOVERABILITY_NOTICE_KEY_PREFIX = "community-discoverability-notice-seen-v1-";

// Shown at most once per account, ever — the honesty mechanism that makes
// discoverable-by-default defensible: a plain fact, not a buried setting.
// Same backdrop+card weight as MemberSearchSheet/CommentSheet, but with a
// neutral "Got it" as the primary action (acknowledge, don't push toward
// opting out) and an equally-reachable text link into the real control.
function DiscoverabilityNotice({
  visible,
  onDismiss,
  onManageSettings,
}: {
  visible: boolean;
  onDismiss: () => void;
  onManageSettings: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.noticeBackdrop}>
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>You&apos;re visible to other members</Text>
          <Text style={styles.noticeBody}>
            By default, other members can find your name, follow you, and see you on leaderboards.
            You can turn any of this off in Settings → Community.
          </Text>
          <Button title="Got it" onPress={onDismiss} style={{ marginTop: Spacing.md }} />
          <Pressable onPress={onManageSettings} hitSlop={8} style={styles.noticeSecondary}>
            <Text style={styles.noticeSecondaryText}>Manage settings</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [metric, setMetric] = useState<LeaderboardMetric>("volume");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<CommunityFeedItem | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const leaderboardY = useRef(0);
  const hasScrolledToLeaderboard = useRef(false);

  const feed = useCommunityFeed();
  const leaderboard = useLeaderboard(metric);
  const suggested = useSuggestedMembers();
  const followUser = useFollowUser();

  const wins = (feed.data?.items ?? []).filter((i) => i.isPersonalBest).slice(0, MAX_WINS);

  const [noticeVisible, setNoticeVisible] = useState(false);
  const noticeKey = user ? DISCOVERABILITY_NOTICE_KEY_PREFIX + user.id : null;

  useEffect(() => {
    if (!noticeKey) return;
    let cancelled = false;
    AsyncStorage.getItem(noticeKey)
      .then((seen) => {
        if (!cancelled && !seen) setNoticeVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [noticeKey]);

  function dismissNotice() {
    setNoticeVisible(false);
    if (noticeKey) AsyncStorage.setItem(noticeKey, "1").catch(() => {});
  }

  function scrollToLeaderboardIfRequested() {
    if (params.tab === "leaderboard" && !hasScrolledToLeaderboard.current && leaderboardY.current > 0) {
      hasScrolledToLeaderboard.current = true;
      scrollRef.current?.scrollTo({ y: leaderboardY.current - Spacing.lg, animated: true });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Community</Text>
        <Pressable onPress={() => setSearchOpen(true)} hitSlop={12} style={styles.followButton}>
          <Ionicons name="person-add-outline" size={15} color={Color.gold} />
          <Text style={styles.followButtonText}>People</Text>
        </Pressable>
      </View>
      <Text style={styles.subhead}>See who&apos;s training, where you rank, and who to follow.</Text>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={Color.gold} />
        }
      >
        {wins.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader label="MEMBER WINS" />
            <Card style={styles.winsCard}>
              {wins.map((item, i) => (
                <WinRow key={item.id} item={item} isLast={i === wins.length - 1} onPress={() => setActiveItem(item)} />
              ))}
            </Card>
          </View>
        ) : null}

        <View
          style={styles.section}
          onLayout={(e) => {
            leaderboardY.current = e.nativeEvent.layout.y;
            scrollToLeaderboardIfRequested();
          }}
        >
          <SectionHeader label="LEADERBOARD" />
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
            <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.md }} />
          ) : !leaderboard.data || leaderboard.data.entries.length === 0 ? (
            <Card tier="quiet">
              <Text style={styles.emptyLeaderboardText}>No entries yet — log a workout to appear here.</Text>
            </Card>
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

        <View style={styles.section}>
          <SectionHeader label="ACTIVITY" />
          {feed.isLoading ? (
            <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.md }} />
          ) : !feed.data || feed.data.items.length === 0 ? (
            <>
              <EmptyState
                icon="people-outline"
                title="Your feed is quiet"
                body="Follow members to see their sessions, PBs and progress here."
              />
              {suggested.isLoading ? (
                <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.sm }} />
              ) : suggested.data && suggested.data.length > 0 ? (
                <Card style={styles.suggestedCard}>
                  <Text style={styles.suggestedLabel}>MEMBERS TO FOLLOW</Text>
                  {suggested.data.map((r, i) => (
                    <SuggestedMemberRow
                      key={r.userId}
                      fullName={r.fullName}
                      isLast={i === suggested.data!.length - 1}
                      pending={followUser.isPending && followUser.variables === r.userId}
                      onFollow={() => {
                        tapFeedback();
                        followUser.mutate(r.userId);
                      }}
                    />
                  ))}
                </Card>
              ) : (
                <Text style={styles.suggestedEmptyText}>No one else to show right now.</Text>
              )}
            </>
          ) : (
            feed.data.items.map((item) => (
              <FeedCard key={item.id} item={item} onOpenComments={() => setActiveItem(item)} />
            ))
          )}
        </View>
      </ScrollView>

      <MemberSearchSheet visible={searchOpen} onClose={() => setSearchOpen(false)} mode="follow" />
      <CommentSheet
        visible={activeItem !== null}
        onClose={() => setActiveItem(null)}
        workoutSessionId={activeItem?.id ?? ""}
      />
      <DiscoverabilityNotice
        visible={noticeVisible}
        onDismiss={dismissNotice}
        onManageSettings={() => {
          dismissNotice();
          router.push("/community-privacy");
        }}
      />
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
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  followButtonText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  subhead: {
    fontSize: 12,
    color: Color.textMuted,
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  suggestedCard: { padding: 0, overflow: "hidden", marginTop: Spacing.sm },
  suggestedLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textFaint,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  suggestedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  suggestedRowDivider: { borderBottomWidth: 1, borderBottomColor: Color.borderSubtle },
  suggestedName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, flex: 1 },
  suggestedFollowButton: { paddingHorizontal: Spacing.md },
  suggestedEmptyText: {
    fontSize: 13,
    color: Color.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  noticeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4,10,20,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  noticeCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
  },
  noticeTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  noticeBody: { fontSize: 13, color: Color.textSecondary, lineHeight: 19, marginTop: Spacing.sm },
  noticeSecondary: { marginTop: Spacing.md, alignSelf: "center" },
  noticeSecondaryText: { fontSize: 12, fontWeight: "500", color: Color.textFaint, textDecorationLine: "underline" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  winsCard: { padding: 0, overflow: "hidden" },
  winRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md },
  winRowDivider: { borderBottomWidth: 1, borderBottomColor: Color.borderSubtle },
  winIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  winText: { fontSize: 13, color: Color.textSecondary, lineHeight: 18 },
  winAuthor: { fontWeight: "700", color: Color.textPrimary },
  winDate: { fontSize: 11, color: Color.textFaint, marginTop: 2 },
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
  feedActionText: { fontSize: 11, fontWeight: "500", color: Color.textFaint },
  metricRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: Spacing.sm,
    padding: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  metricChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: Radius.pill,
    paddingVertical: 7,
  },
  metricChipActive: { backgroundColor: Color.gold },
  metricChipText: { fontSize: 11, fontWeight: "600", color: Color.textFaint },
  metricChipTextActive: { color: Color.goldForeground, fontWeight: "700" },
  emptyLeaderboardText: { fontSize: 12, color: Color.textMuted, textAlign: "center", paddingVertical: Spacing.sm },
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
