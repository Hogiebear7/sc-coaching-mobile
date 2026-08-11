import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useStaffMessageThreads, type StaffMessageThreadSummary } from "@/lib/queries/staff";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ThreadRow({ thread, onPress }: { thread: StaffMessageThreadSummary; onPress: () => void }) {
  const unread = thread.unreadFromMemberCount > 0;
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, unread && styles.rowNameUnread]} numberOfLines={1}>
            {thread.memberName ?? thread.memberEmail}
          </Text>
          <Text style={styles.rowTime}>{formatTime(thread.lastMessageAt)}</Text>
        </View>
        <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
          {thread.lastMessageFromStaff ? "You: " : ""}
          {thread.lastMessageBody}
        </Text>
      </View>
      {unread ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{thread.unreadFromMemberCount}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Color.textFaint} style={{ marginLeft: Spacing.xs }} />
      )}
    </Pressable>
  );
}

export default function StaffMessagesScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useStaffMessageThreads();

  const threads = (data ?? []).filter((t) => !t.memberArchived);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load messages.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          {threads.length === 0 ? (
            <View style={styles.centerFill}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={Color.textFaint} />
              <Text style={[styles.errorText, { marginTop: Spacing.sm }]}>No conversations yet.</Text>
            </View>
          ) : (
            threads.map((t) => (
              <ThreadRow
                key={t.memberId}
                thread={t}
                onPress={() =>
                  router.push({
                    pathname: "/staff-message-thread",
                    params: { memberId: t.memberId, memberName: t.memberName ?? t.memberEmail },
                  })
                }
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowName: { fontSize: 14, fontWeight: "600", color: Color.textSecondary, flexShrink: 1 },
  rowNameUnread: { color: Color.textPrimary, fontWeight: "700" },
  rowTime: { fontSize: 10, color: Color.textFaint, marginLeft: Spacing.xs },
  rowPreview: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  rowPreviewUnread: { color: Color.textSecondary, fontWeight: "500" },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.pill,
    backgroundColor: Color.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: Spacing.xs,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: "700", color: Color.goldForeground },
});
