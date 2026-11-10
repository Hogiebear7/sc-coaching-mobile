import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdultConfirmSheet } from "@/components/ui/AdultConfirmSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChallengeList } from "@/components/ui/ChallengeList";
import { EmptyState } from "@/components/ui/EmptyState";
import { GymCommentSheet } from "@/components/ui/GymCommentSheet";
import { MemberSafetySheet } from "@/components/ui/MemberSafetySheet";
import { ReportReasonSheet } from "@/components/ui/ReportReasonSheet";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { formatCommunityDate } from "@/lib/community-formatters";
import { MAX_GYM_POST } from "@/lib/community-groups-format";
import { tapFeedback } from "@/lib/haptics";
import {
  isAdultConfirmationRequired,
  useAdultConfirmed,
  useChallenges,
  useCreateGymPost,
  useGymCommunityAccess,
  useGymFeed,
  useGymOlderPosts,
  useRemoveGymPost,
  useReportGymContent,
  type GymPost,
} from "@/lib/queries/community-groups";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// The gym's own members-only community (gym Membership). Members and the gym's coaches post and comment; coaches and admins can remove anything and
// set challenges from the staff app. Posts are text only for now.
export default function CommunityGymScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { user } = useAuth();
  const { allowed, isStaff } = useGymCommunityAccess();
  const adult = useAdultConfirmed();
  const feed = useGymFeed();
  const challenges = useChallenges({ type: "gym" }, allowed && feed.isSuccess);
  const createPost = useCreateGymPost();
  const removePost = useRemoveGymPost();
  const report = useReportGymContent();
  const older = useGymOlderPosts();

  const [text, setText] = useState("");
  const [ageSheet, setAgeSheet] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ userId: string; name: string } | null>(null);
  // Older pages are appended below the first page; refreshing the feed drops them so nothing shows twice.
  const [olderPosts, setOlderPosts] = useState<GymPost[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(undefined);

  // The gym's own coaches and admins are not asked to confirm their age (the server doesn't ask them either).
  const needsAdult = allowed && !isStaff && (adult.data === false || isAdultConfirmationRequired(feed.error));
  const posts: GymPost[] = [...(feed.data?.posts ?? []), ...olderPosts.filter((p) => !(feed.data?.posts ?? []).some((f) => f.id === p.id))];
  const cursor = olderCursor === undefined ? feed.data?.nextBefore ?? null : olderCursor;
  const trimmed = text.trim();

  function submit() {
    if (!trimmed) return;
    tapFeedback();
    createPost.mutate(trimmed, {
      onSuccess: () => {
        setText("");
        setOlderPosts([]);
        setOlderCursor(undefined);
      },
      onError: (e) => (isAdultConfirmationRequired(e) ? setAgeSheet(true) : Alert.alert("Couldn't post", e.message)),
    });
  }

  function loadOlder() {
    if (!cursor) return;
    older.mutate(cursor, {
      onSuccess: (page) => {
        setOlderPosts((prev) => [...prev, ...page.posts]);
        setOlderCursor(page.nextBefore);
      },
      onError: (e) => Alert.alert("Couldn't load older posts", e.message),
    });
  }

  function confirmRemove(post: GymPost) {
    Alert.alert("Remove this post?", "It will be removed for everyone, along with its comments.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removePost.mutate(post.id, {
            onSuccess: () => setOlderPosts((prev) => prev.filter((p) => p.id !== post.id)),
            onError: (e) => Alert.alert("Couldn't remove it", e.message),
          }),
      },
    ]);
  }

  function sendReport(reason: string) {
    if (!reportingPost) return;
    report.mutate(
      { targetType: "post", targetId: reportingPost, reason },
      {
        onSuccess: (r) => {
          setReportingPost(null);
          Alert.alert("Reported", r.message);
        },
        onError: (e) => Alert.alert("Couldn't send the report", e.message),
      }
    );
  }

  function refresh() {
    setOlderPosts([]);
    setOlderCursor(undefined);
    feed.refetch();
    challenges.refetch();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Your gym</Text>
        <View style={{ width: 36 }} />
      </View>

      {!allowed ? (
        <View style={styles.scroll}>
          {/* Deliberately not an upsell: the gym Membership is never sold or linked to from inside the app (store rules). */}
          <EmptyState
            icon="barbell-outline"
            title="Your gym's community"
            body="This space is for members of the gym."
          />
        </View>
      ) : needsAdult ? (
        <View style={styles.scroll}>
          <Card style={styles.gateCard}>
            <Text style={styles.gateTitle}>One quick step</Text>
            <Text style={styles.gateBody}>Your gym&apos;s community is for members aged 18 or over. Confirm once and you&apos;re in.</Text>
            <Button title="Confirm I'm 18 or over" onPress={() => setAgeSheet(true)} style={{ marginTop: Spacing.sm }} />
          </Card>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={refresh} tintColor={Color.gold} />}
        >
          <Text style={styles.subhead}>Only members of your gym and its coaches can see this.</Text>

          <View style={styles.section}>
            <SectionHeader
              label="Challenges"
              action={isStaff ? { label: "New challenge", onPress: () => router.push({ pathname: "/community/new-challenge", params: { scope: "gym" } }) } : undefined}
            />
            {challenges.isLoading ? (
              <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.sm }} />
            ) : (challenges.data ?? []).length === 0 ? (
              <Text style={styles.quiet}>No challenges right now. Your coaches set them here.</Text>
            ) : (
              <ChallengeList
                challenges={challenges.data ?? []}
                onOpen={(c) => router.push({ pathname: "/community/challenge", params: { scope: "gym", challengeId: c.id } })}
              />
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader label="Gym feed" />
            <Card style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={(t) => setText(t.slice(0, MAX_GYM_POST))}
                placeholder="Share something with your gym"
                placeholderTextColor={Color.textFaint}
                multiline
                style={styles.input}
                accessibilityLabel="Write a post"
              />
              <View style={styles.composerFoot}>
                <Text style={styles.count}>
                  {trimmed.length}/{MAX_GYM_POST}
                </Text>
                <Button title="Post" onPress={submit} loading={createPost.isPending} disabled={!trimmed} style={styles.postButton} />
              </View>
            </Card>

            {feed.isLoading ? (
              <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.lg }} />
            ) : feed.isError && !isAdultConfirmationRequired(feed.error) ? (
              <EmptyState icon="cloud-offline-outline" title="Couldn't load the feed" body={feed.error.message} actionLabel="Try again" onAction={() => feed.refetch()} />
            ) : posts.length === 0 ? (
              <EmptyState icon="chatbubbles-outline" title="Nothing here yet" body="Be the first to post. Say hello, share a win, ask a question." />
            ) : (
              <>
                {posts.map((p) => {
                  const mine = p.author.userId === user?.id;
                  return (
                    <Card key={p.id} style={styles.post}>
                      <View style={styles.postHead}>
                        <Text style={styles.author} numberOfLines={1}>
                          {mine ? "You" : p.author.displayName}
                          {p.author.isStaff ? "  ·  Coach" : ""}
                        </Text>
                        <Text style={styles.when}>{formatCommunityDate(p.createdAt, "short")}</Text>
                      </View>
                      <Text style={styles.postBody}>{p.body}</Text>
                      <View style={styles.postActions}>
                        <Pressable onPress={() => setCommentsFor(p.id)} hitSlop={8} style={styles.action} accessibilityRole="button">
                          <Ionicons name="chatbubble-outline" size={18} color={Color.textFaint} />
                          <Text style={styles.actionText}>
                            {p.commentCount > 0 ? `${p.commentCount} ${p.commentCount === 1 ? "comment" : "comments"}` : "Comment"}
                          </Text>
                        </Pressable>
                        <View style={styles.spacer} />
                        {p.canRemove ? (
                          <Pressable onPress={() => confirmRemove(p)} hitSlop={8} style={styles.action} accessibilityRole="button">
                            <Text style={styles.actionText}>Remove</Text>
                          </Pressable>
                        ) : null}
                        {!mine ? (
                          <>
                            <Pressable onPress={() => setReportingPost(p.id)} hitSlop={8} style={styles.action} accessibilityRole="button">
                              <Text style={styles.actionText}>Report</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setBlockTarget({ userId: p.author.userId, name: p.author.displayName })}
                              hitSlop={8}
                              style={styles.action}
                              accessibilityRole="button"
                              accessibilityLabel={`Block ${p.author.displayName}`}
                            >
                              <Text style={styles.actionText}>Block</Text>
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    </Card>
                  );
                })}
                {cursor ? (
                  <Button title="Show older posts" variant="secondary" onPress={loadOlder} loading={older.isPending} style={{ marginTop: Spacing.sm }} />
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      )}

      <GymCommentSheet visible={commentsFor !== null} onClose={() => setCommentsFor(null)} postId={commentsFor ?? ""} />
      <ReportReasonSheet
        visible={reportingPost !== null}
        onClose={() => setReportingPost(null)}
        onSubmit={sendReport}
        submitting={report.isPending}
        heading="Report this post"
      />
      {blockTarget ? (
        <MemberSafetySheet visible onClose={() => setBlockTarget(null)} memberUserId={blockTarget.userId} memberName={blockTarget.name} />
      ) : null}
      <AdultConfirmSheet
        visible={ageSheet}
        onClose={() => setAgeSheet(false)}
        onConfirmed={() => {
          setAgeSheet(false);
          feed.refetch();
        }}
        what="your gym's community"
      />
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    subhead: { fontSize: 14, color: Color.textMuted, marginBottom: Spacing.md },
    section: { marginBottom: Spacing.xl },
    quiet: { fontSize: 14, color: Color.textMuted },
    gateCard: { padding: Spacing.lg },
    gateTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    gateBody: { fontSize: 14, color: Color.textSecondary, lineHeight: 20, marginTop: Spacing.xs },
    composer: { padding: Spacing.md },
    input: { minHeight: 72, borderRadius: Radius.md, backgroundColor: Color.surface2, padding: Spacing.sm, fontSize: 15, color: Color.textPrimary, textAlignVertical: "top" },
    composerFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.sm },
    count: { fontSize: 12, color: Color.textFaint },
    postButton: { paddingHorizontal: Spacing.xl },
    post: { padding: Spacing.md, marginTop: Spacing.sm },
    postHead: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.sm },
    author: { flex: 1, fontSize: 15, fontWeight: "700", color: Color.textPrimary },
    when: { fontSize: 12, color: Color.textFaint },
    postBody: { fontSize: 15, color: Color.textSecondary, lineHeight: 22, marginTop: Spacing.xs },
    postActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginTop: Spacing.sm },
    action: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40 },
    actionText: { fontSize: 13, fontWeight: "600", color: Color.textFaint },
    spacer: { flex: 1 },
  })
);
