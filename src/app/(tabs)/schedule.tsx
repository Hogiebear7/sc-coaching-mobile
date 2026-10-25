import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SectionTitle } from "@/components/app/primitives";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ContinueWorkoutPill } from "@/components/ui/ContinueWorkoutPill";
import { Segmented } from "@/components/ui/Segmented";
import { AppRadius, AppSpace, appTitle, Spacing } from "@/constants/theme";
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
import { selectionFeedback } from "@/lib/haptics";
import { makeStyles, useAppTheme } from "@/lib/theme";

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
  const styles = useStyles();
  const { legacy: Color } = useAppTheme();
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
            <Ionicons name="checkmark-circle" size={16} color={Color.success} />
            <Text style={styles.bookedBadgeText}>Booked · manage under Booked</Text>
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
  const styles = useStyles();
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
  const styles = useStyles();
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
  const styles = useStyles();
  const { colors } = useAppTheme();
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
          <Pressable onPress={prevMonth} hitSlop={8} style={styles.calNavButton} accessibilityRole="button" accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.calTitle}>{monthLabel}</Text>
          <Pressable onPress={nextMonth} hitSlop={8} style={styles.calNavButton} accessibilityRole="button" accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <Text key={w} style={styles.weekLabel}>
              {w}
            </Text>
          ))}
        </View>

        {Array.from({ length: 6 }, (_, row) => (
          <View key={row} style={styles.weekRow}>
            {cells.slice(row * 7, row * 7 + 7).map((cell) => {
              const dayClasses = classesByDate[cell.iso] ?? [];
              const isToday = cell.iso === today;
              const isSelected = cell.iso === selectedDate;
              return (
                <Pressable
                  key={cell.iso}
                  onPress={() => {
                    if (!isSelected) selectionFeedback();
                    setSelectedDate(cell.iso);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${cell.iso}${dayClasses.length ? `, ${dayClasses.length} classes` : ""}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    !isSelected && isToday && styles.dayCellToday,
                    !cell.inMonth && styles.dayCellOutside,
                  ]}
                >
                  <Text style={[styles.dayCellText, isToday && styles.dayCellTextToday, isSelected && styles.dayCellTextSelected]}>{cell.day}</Text>
                  {dayClasses.length > 0 ? (
                    <View style={[styles.dayCellDot, isSelected && styles.dayCellDotSelected]} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <View style={styles.calendarDetail}>
        <SectionTitle title={selectedDate ? formatDateLabel(selectedDate) : "Select a date"} />
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
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useSchedule();
  const [tab, setTab] = useState<Tab>("calendar");

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.text} size="large" />
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
      <View style={[styles.header, styles.headerRow]}>
        <Text style={appTitle(34, colors.text)}>Schedule</Text>
        <ContinueWorkoutPill />
      </View>

      <View style={styles.tabBar}>
        <Segmented
          options={["browse", "calendar", "bookings"] as const}
          value={tab}
          onChange={(t) => setTab(t)}
          format={(t) =>
            t === "browse"
              ? "Classes"
              : t === "calendar"
                ? "Calendar"
                : `Booked${data.upcomingBookings.length > 0 ? ` (${data.upcomingBookings.length})` : ""}`
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.text} />}
      >
        {tab === "browse" ? (
          <>
            {pendingOffers.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle title="Needs a response" />
                {pendingOffers.map((c) => (
                  <PendingOfferCard key={c.id} item={c} />
                ))}
              </View>
            ) : null}

            {data.classes.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
                <Text style={styles.emptyText}>No upcoming classes scheduled.</Text>
              </Card>
            ) : (
              sortedDates.map((date) => (
                <View key={date} style={styles.section}>
                  <SectionTitle title={formatDateLabel(date)} />
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
              <SectionTitle title="Upcoming" />
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
                <SectionTitle title="Past" />
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

const useStyles = makeStyles((c, _dc, Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    errorText: { color: c.textMuted, fontSize: 16 },
    header: { paddingHorizontal: AppSpace.gutter, paddingTop: 12 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    tabBar: { marginHorizontal: AppSpace.gutter, marginTop: 16, marginBottom: 16 },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingBottom: 40 },
    section: { marginBottom: AppSpace.section },
    classCard: { padding: 16, marginBottom: 10 },
    classRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    timeBlock: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.control,
      alignItems: "center",
      justifyContent: "center",
    },
    timeText: { fontSize: 18, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    timeSub: { fontSize: 12, color: c.textMuted, fontVariant: ["tabular-nums"] },
    classTitle: { fontSize: 17, fontWeight: "600", color: c.text },
    classMeta: { fontSize: 14, color: c.textMuted, marginTop: 3 },
    blockReason: { fontSize: 14, color: Color.warning, marginTop: 6 },
    actionRow: { marginTop: 14 },
    bookedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: AppRadius.control,
      backgroundColor: Color.successWeak,
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: "center",
    },
    bookedBadgeText: { fontSize: 14, fontWeight: "600", color: Color.success },
    offerBadge: {
      borderRadius: AppRadius.control,
      backgroundColor: Color.warningWeak,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    offerBadgeText: { fontSize: 14, fontWeight: "600", color: Color.warning },
    error: { fontSize: 14, color: c.danger, marginTop: 8 },
    emptyCard: { alignItems: "center", padding: 24, gap: 8 },
    emptyText: { fontSize: 15, color: c.textMuted },
    myBookingCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      marginBottom: 10,
      gap: 14,
    },
    attendedBadge: {
      borderRadius: AppRadius.control,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    attendedBadgeYes: { backgroundColor: Color.successWeak },
    attendedBadgeNo: { backgroundColor: c.control },
    attendedBadgeText: { fontSize: 13, fontWeight: "600", color: c.textMuted },
    attendedBadgeTextYes: { color: Color.success },
    cutoffHint: { fontSize: 14, color: c.textMuted, marginTop: 6, lineHeight: 20 },
    offerCard: { padding: 16, marginBottom: 10 },
    offerTitle: { fontSize: 17, fontWeight: "600", color: c.text },
    offerMeta: { fontSize: 14, color: c.textMuted, marginTop: 3, marginBottom: 14 },
    offerButtonRow: { flexDirection: "row", gap: 10 },
    calendarCard: { padding: 14 },
    calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    calNavButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.control,
    },
    calTitle: { fontSize: 17, fontWeight: "600", color: c.text },
    weekRow: { flexDirection: "row", marginBottom: 4 },
    weekLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: c.textMuted },
    // flex:1 across each week's own row, not a `${100/7}%` width inside a
    // flex-wrap grid — the percentage-rounding version silently dropped the
    // 7th cell (Sunday) onto the next row on some screen widths. See
    // MonthDatePicker.tsx, which established this fix first.
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      gap: 3,
    },
    dayCellSelected: { backgroundColor: c.primary },
    dayCellToday: { borderWidth: 1.5, borderColor: c.text },
    dayCellOutside: { opacity: 0.35 },
    dayCellText: { fontSize: 15, color: c.text, fontVariant: ["tabular-nums"] },
    dayCellTextToday: { fontWeight: "700" },
    dayCellTextSelected: { color: c.onPrimary, fontWeight: "700" },
    dayCellDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.text },
    dayCellDotSelected: { backgroundColor: c.onPrimary },
    calendarDetail: { marginTop: AppSpace.section },
  })
);
