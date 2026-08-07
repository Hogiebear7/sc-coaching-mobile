import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import {
  useBookClass,
  useCancelBooking,
  useJoinWaitlist,
  useLeaveWaitlist,
  useSchedule,
  type ScheduleClass,
} from "@/lib/queries/schedule";

function formatDateLabel(dateISO: string): string {
  const d = new Date(dateISO);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function ClassRow({ item }: { item: ScheduleClass }) {
  const [error, setError] = useState<string | null>(null);
  const book = useBookClass();
  const joinWaitlist = useJoinWaitlist();
  const leaveWaitlist = useLeaveWaitlist();

  const busy = book.isPending || joinWaitlist.isPending || leaveWaitlist.isPending;

  async function run(action: () => Promise<{ success: boolean; message: string }>) {
    setError(null);
    try {
      const res = await action();
      if (!res.success) setError(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <Card style={styles.classCard}>
      <View style={styles.classRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeText}>{item.startTime.split(":")[0]}</Text>
          <Text style={styles.timeSub}>:{item.startTime.split(":")[1]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.classTitle}>{item.title}</Text>
          <Text style={styles.classMeta}>
            {formatDateLabel(item.date)} · {item.durationMins} min · {item.bookedCount}/{item.capacity}
          </Text>
          {item.blockReason ? <Text style={styles.blockReason}>{item.blockReason}</Text> : null}
        </View>
      </View>

      <View style={styles.actionRow}>
        {item.isBookedByMe ? (
          <View style={styles.bookedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={Color.success} />
            <Text style={styles.bookedBadgeText}>Booked — manage in My Bookings above</Text>
          </View>
        ) : item.waitlistOfferState === "offered" ? (
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeText}>Offer pending — respond from Home</Text>
          </View>
        ) : item.isWaitlistedByMe ? (
          <Button
            title={`Leave waitlist${item.waitlistPosition ? ` (#${item.waitlistPosition})` : ""}`}
            variant="secondary"
            loading={leaveWaitlist.isPending}
            disabled={busy}
            onPress={() => run(() => leaveWaitlist.mutateAsync(item.id))}
          />
        ) : item.isFull ? (
          <Button
            title="Join waitlist"
            variant="secondary"
            loading={joinWaitlist.isPending}
            disabled={busy}
            onPress={() => run(() => joinWaitlist.mutateAsync(item.id))}
          />
        ) : (
          <Button
            title="Book"
            loading={book.isPending}
            disabled={busy || !!item.blockReason}
            onPress={() => run(() => book.mutateAsync(item.id))}
          />
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

function MyBookingRow({ bookingId, title, date, startTime }: { bookingId: string; title: string; date: string; startTime: string }) {
  const [error, setError] = useState<string | null>(null);
  const cancel = useCancelBooking();

  return (
    <Card style={styles.myBookingCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.classTitle}>{title}</Text>
        <Text style={styles.classMeta}>
          {formatDateLabel(date)} · {startTime}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Button
        title="Cancel"
        variant="secondary"
        loading={cancel.isPending}
        onPress={async () => {
          setError(null);
          try {
            const res = await cancel.mutateAsync(bookingId);
            if (!res.success) setError(res.message);
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Something went wrong.");
          }
        }}
      />
    </Card>
  );
}

export default function ScheduleScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useSchedule();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load the schedule.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
      >
        <Text style={styles.heading}>Schedule</Text>

        {data.upcomingBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MY BOOKINGS</Text>
            {data.upcomingBookings.map((b) => (
              <MyBookingRow key={b.bookingId} bookingId={b.bookingId} title={b.title} date={b.date} startTime={b.startTime} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UPCOMING CLASSES</Text>
          {data.classes.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={22} color={Color.textFaint} />
              <Text style={styles.emptyText}>No upcoming classes scheduled.</Text>
            </Card>
          ) : (
            data.classes.map((c) => <ClassRow key={c.id} item={c} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "italic",
    color: Color.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
    marginBottom: Spacing.sm,
  },
  classCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  classRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  timeBlock: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: { fontSize: 16, fontWeight: "700", color: Color.gold },
  timeSub: { fontSize: 10, color: Color.gold, opacity: 0.8 },
  classTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  classMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  blockReason: { fontSize: 11, color: Color.warning, marginTop: 4 },
  actionRow: { marginTop: Spacing.sm },
  bookedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.success,
    backgroundColor: Color.successWeak,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    justifyContent: "center",
  },
  bookedBadgeText: { fontSize: 11, fontWeight: "600", color: Color.success },
  offerBadge: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.warning,
    backgroundColor: Color.warningWeak,
    paddingVertical: 10,
    alignItems: "center",
  },
  offerBadgeText: { fontSize: 12, fontWeight: "600", color: Color.warning },
  error: { fontSize: 11, color: Color.danger, marginTop: Spacing.xs },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 12, color: Color.textMuted },
  myBookingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
});
