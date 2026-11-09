import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import {
  buildChallengeRows,
  challengeMetricHint,
  challengeMetricLabel,
  challengeStatusLabel,
  formatChallengeDates,
} from "@/lib/community-groups-format";
import { useCancelChallenge, useChallengeStandings, useGroup, type ChallengeScope } from "@/lib/queries/community-groups";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// One challenge and its standings. Standings are worked out on the server from each member's logged workouts inside the dates, and honour every
// member's own leaderboard-visibility and real-name settings, so this screen only shows what the server returns.
export default function ChallengeScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ scope: string; groupId?: string; challengeId: string }>();
  const challengeId = typeof params.challengeId === "string" ? params.challengeId : "";
  const groupId = typeof params.groupId === "string" ? params.groupId : "";
  const scope: ChallengeScope = params.scope === "gym" ? { type: "gym" } : { type: "group", id: groupId };

  const standings = useChallengeStandings(scope, challengeId);
  // Only a group's organiser can cancel its challenge, and only the gym's coaches and admins can cancel a gym one. (The server checks both.)
  const { user } = useAuth();
  const group = useGroup(scope.type === "group" ? groupId : "");
  const cancel = useCancelChallenge(scope);

  const data = standings.data;
  const challenge = data?.challenge;
  const mayCancel = scope.type === "group" ? group.data?.isOrganiser === true : !!user && user.role !== "member";
  const canCancel = mayCancel && (challenge?.status === "active" || challenge?.status === "upcoming");

  function confirmCancel() {
    Alert.alert("Cancel this challenge?", "It ends now for everyone. This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel challenge",
        style: "destructive",
        onPress: () => cancel.mutate(challengeId, { onError: (e) => Alert.alert("Couldn't cancel", e.message) }),
      },
    ]);
  }

  const rows = data && challenge ? buildChallengeRows(data.entries, challenge.metric, data.myUserId) : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {challenge?.title ?? "Challenge"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {standings.isLoading ? (
        <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.xl }} />
      ) : standings.isError || !data || !challenge ? (
        <View style={styles.scroll}>
          <EmptyState
            icon="alert-circle-outline"
            title="Couldn't load this challenge"
            body={standings.error?.message ?? "It may have been removed."}
            actionLabel="Try again"
            onAction={() => standings.refetch()}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={standings.isRefetching} onRefresh={() => standings.refetch()} tintColor={Color.gold} />}
        >
          <View style={styles.summary}>
            <View style={[styles.pill, challenge.status === "active" && styles.pillActive]}>
              <Text style={[styles.pillText, challenge.status === "active" && styles.pillTextActive]}>{challengeStatusLabel(challenge.status)}</Text>
            </View>
            <Text style={styles.metric}>{challengeMetricLabel(challenge.metric)}</Text>
            <Text style={styles.dates}>{formatChallengeDates(challenge.startDate, challenge.endDate)}</Text>
            <Text style={styles.hint}>{challengeMetricHint(challenge.metric)}</Text>
          </View>

          {data.iAmHidden ? (
            <Card style={styles.notice}>
              <Text style={styles.noticeText}>
                You&apos;ve turned your leaderboard visibility off, so you don&apos;t appear in the standings. You can change this in Community privacy.
              </Text>
              <Pressable onPress={() => router.push("/community-privacy")} hitSlop={8} style={styles.noticeLink} accessibilityRole="button">
                <Text style={styles.noticeLinkText}>Open Community privacy</Text>
              </Pressable>
            </Card>
          ) : null}

          <Text style={styles.sectionLabel}>Standings</Text>
          {rows.length === 0 ? (
            <EmptyState
              icon="podium-outline"
              title={challenge.status === "upcoming" ? "Not started yet" : "No scores yet"}
              body={
                challenge.status === "upcoming"
                  ? "What you log from the start date counts automatically."
                  : "Log a workout or some cardio inside the dates and it counts automatically."
              }
            />
          ) : (
            <Card style={styles.card}>
              {rows.map((row, i) => (
                <View key={row.userId} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <Text style={[styles.rank, row.isMe && styles.me]}>{row.rank}</Text>
                  <Text style={[styles.name, row.isMe && styles.me]} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={[styles.value, row.isMe && styles.me]}>{row.valueLabel}</Text>
                </View>
              ))}
            </Card>
          )}

          {canCancel ? (
            <Button title="Cancel challenge" variant="secondary" onPress={confirmCancel} loading={cancel.isPending} style={{ marginTop: Spacing.xl }} />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    summary: { alignItems: "flex-start", marginBottom: Spacing.lg },
    pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Color.surface2 },
    pillActive: { backgroundColor: Color.gold },
    pillText: { fontSize: 12, fontWeight: "600", color: Color.textFaint },
    pillTextActive: { color: Color.goldForeground },
    metric: { fontSize: 22, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.sm },
    dates: { fontSize: 14, color: Color.textMuted, marginTop: 2 },
    hint: { fontSize: 13, color: Color.textMuted, lineHeight: 18, marginTop: Spacing.xs },
    notice: { padding: Spacing.md, marginBottom: Spacing.md },
    noticeText: { fontSize: 14, color: Color.textSecondary, lineHeight: 20 },
    noticeLink: { marginTop: Spacing.xs, minHeight: 40, justifyContent: "center" },
    noticeLinkText: { fontSize: 14, fontWeight: "600", color: Color.gold },
    sectionLabel: { fontSize: 17, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.sm },
    card: { padding: 0, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 48 },
    rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    rank: { fontSize: 13, fontWeight: "700", color: Color.textFaint, width: 24 },
    name: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, flex: 1 },
    value: { fontSize: 14, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
    me: { color: Color.gold },
  })
);
