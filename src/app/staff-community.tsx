import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChallengeList } from "@/components/ui/ChallengeList";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Spacing } from "@/constants/theme";
import { formatCommunityDate } from "@/lib/community-formatters";
import { tapFeedback } from "@/lib/haptics";
import { useChallenges } from "@/lib/queries/community-groups";
import { useGymReports, useResolveGymReport, type GymReport } from "@/lib/queries/staff-community";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// The gym community from the coach's side: reports of posts and comments to review, the gym's challenges (set and cancel), and a way into the feed to
// post or remove things directly. Reports go to the gym's own coaches and admins only; the server limits everything here to the signed-in staff member's gym.
function ReportCard({ report }: { report: GymReport }) {
  const styles = useStyles();
  const resolve = useResolveGymReport();

  function act(action: "resolve" | "dismiss") {
    tapFeedback();
    const remove = action === "resolve";
    const isGroup = report.targetType === "group";
    Alert.alert(
      remove ? (isGroup ? "Close this group?" : `Remove this ${report.targetType}?`) : "Dismiss this report?",
      remove
        ? isGroup
          ? "The group is closed for everyone, its members lose access, and the report is closed."
          : "It will be removed for everyone and the report closed."
        : "The report is closed and nothing is removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: remove ? (isGroup ? "Close group" : "Remove") : "Dismiss",
          style: remove ? "destructive" : "default",
          onPress: () => resolve.mutate({ id: report.id, action }, { onError: (e) => Alert.alert("Couldn't update the report", e.message) }),
        },
      ]
    );
  }

  return (
    <Card style={styles.report}>
      <View style={styles.reportHead}>
        <Text style={styles.reportKind}>{report.targetType === "post" ? "Post" : report.targetType === "group" ? "Group" : "Comment"}</Text>
        <Text style={styles.when}>{formatCommunityDate(report.createdAt, "short")}</Text>
      </View>
      {report.text ? (
        <Text style={styles.reportText}>{report.text}</Text>
      ) : (
        <Text style={styles.muted}>The text is no longer available.</Text>
      )}
      <Text style={styles.meta}>
        {report.targetType === "group" ? "Organised by" : "By"} {report.author ? report.author.displayName : "unknown"} · reported by {report.reporterName}
      </Text>
      <Text style={styles.reason}>Reason: {report.reason}</Text>
      {report.alreadyRemoved ? <Text style={styles.muted}>Already removed.</Text> : null}
      <View style={styles.actions}>
        {report.alreadyRemoved ? null : (
          <Button title={report.targetType === "group" ? "Close group" : "Remove"} onPress={() => act("resolve")} loading={resolve.isPending} style={styles.actionButton} />
        )}
        <Button title={report.alreadyRemoved ? "Close report" : "Dismiss"} variant="secondary" onPress={() => act("dismiss")} disabled={resolve.isPending} style={styles.actionButton} />
      </View>
    </Card>
  );
}

export default function StaffCommunityScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const reports = useGymReports("open");
  const challenges = useChallenges({ type: "gym" });

  function refresh() {
    reports.refetch();
    challenges.refetch();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Gym community</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={reports.isRefetching || challenges.isRefetching} onRefresh={refresh} tintColor={Color.gold} />}
      >
        <Button title="Open the gym feed" variant="secondary" onPress={() => router.push("/community/gym")} />

        <View style={styles.section}>
          <SectionHeader label={`Reports to review${reports.data && reports.data.length > 0 ? ` (${reports.data.length})` : ""}`} />
          {reports.isLoading ? (
            <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.md }} />
          ) : reports.isError ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load reports" body={reports.error.message} actionLabel="Try again" onAction={() => reports.refetch()} />
          ) : (reports.data ?? []).length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" title="Nothing to review" body="When a member reports a post or comment, it shows up here." />
          ) : (
            (reports.data ?? []).map((r) => <ReportCard key={r.id} report={r} />)
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            label="Challenges"
            action={{ label: "New challenge", onPress: () => router.push({ pathname: "/community/new-challenge", params: { scope: "gym" } }) }}
          />
          {challenges.isLoading ? (
            <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.md }} />
          ) : challenges.isError ? (
            <Text style={styles.muted}>{challenges.error.message}</Text>
          ) : (challenges.data ?? []).length === 0 ? (
            <EmptyState icon="trophy-outline" title="No challenges yet" body="Set one and members' logged workouts count towards it automatically. Up to 5 can be open at once." />
          ) : (
            <ChallengeList
              challenges={challenges.data ?? []}
              onOpen={(c) => router.push({ pathname: "/community/challenge", params: { scope: "gym", challengeId: c.id } })}
            />
          )}
        </View>
      </ScrollView>
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
    section: { marginTop: Spacing.xl },
    report: { padding: Spacing.md, marginBottom: Spacing.sm },
    reportHead: { flexDirection: "row", justifyContent: "space-between" },
    reportKind: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textFaint, textTransform: "uppercase" },
    when: { fontSize: 12, color: Color.textFaint },
    reportText: { fontSize: 15, color: Color.textPrimary, lineHeight: 22, marginTop: Spacing.xs },
    meta: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.xs },
    reason: { fontSize: 13, color: Color.textSecondary, marginTop: 2 },
    muted: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.xs },
    actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
    actionButton: { flex: 1, paddingHorizontal: Spacing.sm },
  })
);
