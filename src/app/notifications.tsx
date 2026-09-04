import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationRecord,
  type NotificationType,
} from "@/lib/queries/notifications";
import { mapLinkHrefToRoute } from "@/lib/push-notifications";

const TYPE_LABEL: Record<NotificationType, string> = {
  message: "Message",
  membership: "Membership",
  class_reminder: "Class reminder",
  booking_confirmed: "Booking confirmed",
  booking_cancelled: "Booking cancelled",
  cancellation: "Cancellation",
  waitlist_offer: "Spot offer",
  waitlist_timeout: "Offer expiring",
  readiness_alert: "Readiness alert",
  cancellation_credit_restored: "Credit restored",
  no_show: "Missed class",
  training_reminder: "Training reminder",
  training_checkin: "Weekly check-in",
};

const TYPE_ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  message: "chatbubble-ellipses-outline",
  membership: "card-outline",
  class_reminder: "calendar-outline",
  booking_confirmed: "checkmark-circle-outline",
  // Same icon as `cancellation` — the web dashboard's own TYPE_ICON uses an
  // identical SVG path for both, since a cancelled booking is the same
  // "cancelled" concept either way.
  booking_cancelled: "close-circle-outline",
  cancellation: "close-circle-outline",
  waitlist_offer: "star-outline",
  waitlist_timeout: "time-outline",
  readiness_alert: "heart-outline",
  cancellation_credit_restored: "return-up-back-outline",
  no_show: "alert-circle-outline",
  training_reminder: "barbell-outline",
  training_checkin: "flag-outline",
};

// Mirrors the web app's urgent/routine split (dashboard/notifications/
// NotificationsView.tsx) — spot offers and their timeouts have a real expiry,
// so they get their own group ahead of routine updates.
const TYPE_IS_URGENT: Record<NotificationType, boolean> = {
  message: false,
  membership: false,
  class_reminder: false,
  booking_confirmed: false,
  booking_cancelled: false,
  cancellation: false,
  waitlist_offer: true,
  waitlist_timeout: true,
  readiness_alert: true,
  cancellation_credit_restored: false,
  no_show: false,
  training_reminder: false,
  training_checkin: false,
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function NotificationRow({
  notification: n,
  urgent,
  onPress,
}: {
  notification: NotificationRecord;
  urgent: boolean;
  onPress: () => void;
}) {
  const isUnread = n.readAt === null;
  const accentColor = urgent ? Color.gold : Color.accentData;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        {isUnread ? <View style={[styles.unreadBar, { backgroundColor: accentColor }]} /> : null}
        <View style={styles.rowInner}>
          <View style={[styles.iconChip, { backgroundColor: `${accentColor}26` }]}>
            <Ionicons name={TYPE_ICON[n.type]} size={16} color={accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowTop}>
              <Text style={[styles.typeLabel, { color: accentColor }]}>{TYPE_LABEL[n.type]}</Text>
              <View style={styles.rowTimeWrap}>
                {isUnread ? <View style={[styles.dot, { backgroundColor: accentColor }]} /> : null}
                <Text style={styles.time}>{formatRelativeTime(n.createdAt)}</Text>
              </View>
            </View>
            <Text style={[styles.title, !isUnread && styles.titleRead]}>{n.title}</Text>
            <Text style={styles.body}>{n.body}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => n.readAt === null).length;
  const urgent = notifications.filter((n) => TYPE_IS_URGENT[n.type]);
  const routine = notifications.filter((n) => !TYPE_IS_URGENT[n.type]);

  function handlePress(n: NotificationRecord) {
    if (n.readAt === null) markRead.mutate(n.id);
    if (n.linkHref) router.push(mapLinkHrefToRoute(n.linkHref) as never);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load notifications.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />
          }
        >
          {unreadCount > 0 ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              style={styles.markAllButton}
            >
              <Text style={styles.markAllText}>
                {markAllRead.isPending ? "Marking…" : "Mark all read"}
              </Text>
            </Pressable>
          ) : null}

          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-outline" size={28} color={Color.textFaint} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyBody}>
                Messages from your coach and membership updates will appear here.
              </Text>
            </View>
          ) : (
            <>
              {urgent.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>NEEDS A RESPONSE</Text>
                  <View style={{ gap: Spacing.sm }}>
                    {urgent.map((n) => (
                      <NotificationRow key={n.id} notification={n} urgent onPress={() => handlePress(n)} />
                    ))}
                  </View>
                </View>
              ) : null}

              {routine.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>UPDATES</Text>
                  <View style={{ gap: Spacing.sm }}>
                    {routine.map((n) => (
                      <NotificationRow key={n.id} notification={n} urgent={false} onPress={() => handlePress(n)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
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
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  markAllButton: { alignSelf: "flex-end", paddingVertical: Spacing.xs, marginBottom: Spacing.sm },
  markAllText: { fontSize: 12, fontWeight: "600", color: Color.textMuted, textDecorationLine: "underline" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xxl, gap: Spacing.xs },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, marginTop: 4 },
  emptyBody: { fontSize: 12, color: Color.textMuted, textAlign: "center", maxWidth: 260 },
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.gold,
    marginBottom: Spacing.sm,
  },
  row: { padding: 0 },
  unreadBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  rowInner: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingLeft: Spacing.md + 4,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  typeLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  rowTimeWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  time: { fontSize: 11, color: Color.textFaint },
  title: { fontSize: 13, fontWeight: "600", color: Color.textPrimary, marginTop: 4 },
  titleRead: { color: Color.textSecondary },
  body: { fontSize: 12, color: Color.textMuted, marginTop: 2, lineHeight: 16 },
});
