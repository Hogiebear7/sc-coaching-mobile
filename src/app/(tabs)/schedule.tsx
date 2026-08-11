import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
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
  useRespondToOffer,
  useSchedule,
  type ScheduleClass,
  type ScheduleUpcomingBooking,
} from "@/lib/queries/schedule";

type Tab = "browse" | "calendar" | "bookings";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayISO(): string {
  const t = new Date();
  return isoOf(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatDateLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
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
            <Text style={styles.bookedBadgeText}>Booked — manage in My Bookings</Text>
          </View>
        ) : item.waitlistOfferState === "offered" ? (
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeText}>Offer pending — respond below</Text>
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

function PendingOfferCard({ item }: { item: ScheduleClass }) {
  const [error, setError] = useState<string | null>(null);
  const respond = useRespondToOffer();

  async function handle(action: "accept" | "reject") {
    if (!item.waitlistEntryId) return;
    setError(null);
    try {
      const res = await respond.mutateAsync({ entryId: item.waitlistEntryId, action });
      if (!res.success) setError(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <Card style={styles.offerCard}>
      <Text style={styles.offerTitle}>{item.title}</Text>
      <Text style={styles.offerMeta}>
        {formatDateLabel(item.date)} · {item.startTime}
      </Text>
      <View style={styles.offerButtonRow}>
        <Button
          title={respond.isPending ? "Confirming…" : "Accept"}
          loading={respond.isPending}
          disabled={respond.isPending}
          onPress={() => handle("accept")}
          style={{ flex: 1 }}
        />
        <Button
          title="Decline"
          variant="secondary"
          disabled={respond.isPending}
          onPress={() => handle("reject")}
          style={{ flex: 1 }}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

function MyBookingRow({ booking, cancellable }: { booking: ScheduleUpcomingBooking; cancellable: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const cancel = useCancelBooking();

  return (
    <Card style={styles.myBookingCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.classTitle}>{booking.title}</Text>
        <Text style={styles.classMeta}>
          {formatDateLabel(booking.date)} · {booking.startTime}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      {cancellable ? (
        <Button
          title="Cancel"
          variant="secondary"
          loading={cancel.isPending}
          onPress={async () => {
            setError(null);
            try {
              const res = await cancel.mutateAsync(booking.bookingId);
              if (!res.success) setError(res.message);
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Something went wrong.");
            }
          }}
        />
      ) : (
        <View style={[styles.attendedBadge, booking.attended ? styles.attendedBadgeYes : styles.attendedBadgeNo]}>
          <Text style={[styles.attendedBadgeText, booking.attended && styles.attendedBadgeTextYes]}>
            {booking.attended ? "Attended" : "Not checked in"}
          </Text>
        </View>
      )}
    </Card>
  );
}

function ScheduleCalendarTab({ classesByDate }: { classesByDate: Record<string, ScheduleClass[]> }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO());

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const result: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = firstWeekday; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      result.push({ iso: isoOf(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({ iso: isoOf(year, month, day), day, inMonth: true });
    }
    while (result.length < 42) {
      const last = result[result.length - 1];
      const [y, m, d] = last.iso.split("-").map(Number);
      const next = new Date(y, m - 1, d + 1);
      result.push({ iso: isoOf(next.getFullYear(), next.getMonth(), next.getDate()), day: next.getDate(), inMonth: false });
    }
    return result;
  }, [year, month, firstWeekday, daysInMonth]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedClasses = selectedDate ? (classesByDate[selectedDate] ?? []) : [];
  const today = todayISO();

  return (
    <View>
      <Card style={styles.calendarCard}>
        <View style={styles.calHeader}>
          <Pressable onPress={prevMonth} hitSlop={12} style={styles.calNavButton}>
            <Ionicons name="chevron-back" size={18} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.calTitle}>{monthLabel}</Text>
          <Pressable onPress={nextMonth} hitSlop={12} style={styles.calNavButton}>
            <Ionicons name="chevron-forward" size={18} color={Color.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <Text key={w} style={styles.weekLabel}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((cell) => {
            const dayClasses = classesByDate[cell.iso] ?? [];
            const isToday = cell.iso === today;
            const isSelected = cell.iso === selectedDate;
            return (
              <Pressable
                key={cell.iso}
                onPress={() => setSelectedDate(cell.iso)}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  !isSelected && isToday && styles.dayCellToday,
                  !cell.inMonth && styles.dayCellOutside,
                ]}
              >
                <Text style={[styles.dayCellText, isToday && styles.dayCellTextToday]}>{cell.day}</Text>
                {dayClasses.length > 0 ? (
                  <View style={styles.dayCellBadge}>
                    <Text style={styles.dayCellBadgeText}>{dayClasses.length}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.calendarDetail}>
        <Text style={styles.sectionLabel}>{selectedDate ? formatDateLabel(selectedDate).toUpperCase() : "SELECT A DATE"}</Text>
        {selectedClasses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No classes scheduled.</Text>
          </Card>
        ) : (
          selectedClasses.map((c) => <ClassRow key={c.id} item={c} />)
        )}
      </View>
    </View>
  );
}

export default function ScheduleScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useSchedule();
  const [tab, setTab] = useState<Tab>("browse");

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

  const classesByDate = data.classes.reduce<Record<string, ScheduleClass[]>>((acc, c) => {
    if (!acc[c.date]) acc[c.date] = [];
    acc[c.date].push(c);
    return acc;
  }, {});
  const sortedDates = Object.keys(classesByDate).sort();
  const pendingOffers = data.classes.filter((c) => c.waitlistOfferState === "offered" && c.waitlistEntryId);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Schedule</Text>
      </View>

      <View style={styles.tabBar}>
        <Pressable onPress={() => setTab("browse")} style={[styles.tabButton, tab === "browse" && styles.tabButtonActive]}>
          <Text style={[styles.tabButtonText, tab === "browse" && styles.tabButtonTextActive]}>Browse</Text>
        </Pressable>
        <Pressable onPress={() => setTab("calendar")} style={[styles.tabButton, tab === "calendar" && styles.tabButtonActive]}>
          <Text style={[styles.tabButtonText, tab === "calendar" && styles.tabButtonTextActive]}>Calendar</Text>
        </Pressable>
        <Pressable onPress={() => setTab("bookings")} style={[styles.tabButton, tab === "bookings" && styles.tabButtonActive]}>
          <Text style={[styles.tabButtonText, tab === "bookings" && styles.tabButtonTextActive]}>
            My bookings{data.upcomingBookings.length > 0 ? ` (${data.upcomingBookings.length})` : ""}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
      >
        {tab === "browse" ? (
          <>
            {pendingOffers.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>NEEDS A RESPONSE</Text>
                {pendingOffers.map((c) => (
                  <PendingOfferCard key={c.id} item={c} />
                ))}
              </View>
            ) : null}

            {data.classes.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={22} color={Color.textFaint} />
                <Text style={styles.emptyText}>No upcoming classes scheduled.</Text>
              </Card>
            ) : (
              sortedDates.map((date) => (
                <View key={date} style={styles.section}>
                  <Text style={styles.sectionLabel}>{formatDateLabel(date).toUpperCase()}</Text>
                  {classesByDate[date].map((c) => (
                    <ClassRow key={c.id} item={c} />
                  ))}
                </View>
              ))
            )}
          </>
        ) : null}

        {tab === "calendar" ? <ScheduleCalendarTab classesByDate={classesByDate} /> : null}

        {tab === "bookings" ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>UPCOMING</Text>
              {data.upcomingBookings.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No upcoming bookings.</Text>
                </Card>
              ) : (
                data.upcomingBookings.map((b) => <MyBookingRow key={b.bookingId} booking={b} cancellable />)
              )}
              {data.cancellationCutoffHours > 0 && data.upcomingBookings.length > 0 ? (
                <Text style={styles.cutoffHint}>
                  Cancel at least {data.cancellationCutoffHours}h before a class to restore your session credit.
                </Text>
              ) : null}
            </View>

            {data.pastBookings.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PAST</Text>
                {data.pastBookings.map((b) => (
                  <MyBookingRow key={b.bookingId} booking={b} cancellable={false} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "italic",
    color: Color.textPrimary,
  },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  tabButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: "center" },
  tabButtonActive: { backgroundColor: Color.surface2 },
  tabButtonText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  tabButtonTextActive: { color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
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
  attendedBadge: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  attendedBadgeYes: { borderColor: Color.success, backgroundColor: Color.successWeak },
  attendedBadgeNo: { borderColor: Color.borderSubtle, backgroundColor: Color.surface2 },
  attendedBadgeText: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  attendedBadgeTextYes: { color: Color.success },
  cutoffHint: { fontSize: 11, color: Color.textFaint, marginTop: Spacing.xs },
  offerCard: { padding: Spacing.md, marginBottom: Spacing.sm, borderColor: Color.goldBorder },
  offerTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  offerMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2, marginBottom: Spacing.sm },
  offerButtonRow: { flexDirection: "row", gap: Spacing.sm },
  calendarCard: { padding: Spacing.md },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  calNavButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface2,
  },
  calTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  weekRow: { flexDirection: "row", marginBottom: Spacing.xs },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "600", color: Color.textFaint },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    gap: 2,
  },
  dayCellSelected: { backgroundColor: Color.goldWeak, borderWidth: 1, borderColor: Color.gold },
  dayCellToday: { borderWidth: 1, borderColor: Color.goldBorder },
  dayCellOutside: { opacity: 0.35 },
  dayCellText: { fontSize: 13, color: Color.textSecondary },
  dayCellTextToday: { color: Color.gold, fontWeight: "700" },
  dayCellBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: Radius.pill,
    backgroundColor: Color.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  dayCellBadgeText: { fontSize: 9, fontWeight: "700", color: Color.goldForeground },
  calendarDetail: { marginTop: Spacing.lg },
});
