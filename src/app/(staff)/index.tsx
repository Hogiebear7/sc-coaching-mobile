import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { useProvisionMemberProfile } from "@/lib/queries/profile";
import { useMarkAttendance, useRemoveBooking, useStaffClasses, type StaffClassSummary } from "@/lib/queries/staff";

function formatClassDate(dateISO: string): string {
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

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function RosterRow({ classId, entry }: { classId: string; entry: StaffClassSummary["roster"][number] }) {
  const mark = useMarkAttendance();
  const removeBooking = useRemoveBooking();
  const attended = !!entry.attendedAt;

  function confirmRemove() {
    Alert.alert(
      "Remove from class?",
      `${entry.fullName ?? entry.email} will be removed from this booking and their credit will be returned.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            tapFeedback();
            removeBooking.mutate(entry.bookingId, {
              onError: () => Alert.alert("Couldn't remove", "Please try again."),
            });
          },
        },
      ]
    );
  }

  return (
    <View style={styles.rosterRow}>
      <Pressable
        onPress={() => {
          successFeedback();
          mark.mutate({ bookingId: entry.bookingId, attended: !attended });
        }}
        disabled={mark.isPending}
        style={styles.rosterRowMain}
      >
        <Ionicons
          name={attended ? "checkmark-circle" : "ellipse-outline"}
          size={20}
          color={attended ? Color.success : Color.textFaint}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.rosterName}>{entry.fullName ?? entry.email}</Text>
          {entry.fullName ? <Text style={styles.rosterEmail}>{entry.email}</Text> : null}
        </View>
      </Pressable>
      <Pressable onPress={confirmRemove} disabled={removeBooking.isPending} hitSlop={10} style={styles.rosterRemoveButton}>
        {removeBooking.isPending ? (
          <ActivityIndicator size="small" color={Color.danger} />
        ) : (
          <Ionicons name="close-circle-outline" size={18} color={Color.danger} />
        )}
      </Pressable>
    </View>
  );
}

function ClassCard({ classItem }: { classItem: StaffClassSummary }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const full = classItem.bookedCount >= classItem.capacity;

  return (
    <Card style={styles.classCard}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.classHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.classTitle}>{classItem.title}</Text>
          <Text style={styles.classMeta}>
            {formatTime(classItem.startTime)} · {classItem.durationMins} min · {classItem.coachEmail}
          </Text>
        </View>
        <View style={[styles.capacityChip, full && styles.capacityChipFull]}>
          <Text style={[styles.capacityChipText, full && styles.capacityChipTextFull]}>
            {classItem.bookedCount}/{classItem.capacity}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Color.textFaint}
          style={{ marginLeft: Spacing.sm }}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.roster}>
          {classItem.roster.length === 0 ? (
            <Text style={styles.rosterEmpty}>No bookings yet.</Text>
          ) : (
            classItem.roster.map((entry) => (
              <RosterRow key={entry.bookingId} classId={classItem.id} entry={entry} />
            ))
          )}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/class-workout-builder",
                params: {
                  classId: classItem.id,
                  classTitle: classItem.title,
                  classDate: classItem.date,
                  startTime: classItem.startTime,
                },
              })
            }
            style={styles.workoutButton}
          >
            <Ionicons name="barbell-outline" size={14} color={Color.gold} />
            <Text style={styles.workoutButtonText}>Workout</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

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

function StaffClassesCalendar({ classesByDate }: { classesByDate: Record<string, StaffClassSummary[]> }) {
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
        <Text style={styles.dateLabel}>{selectedDate ? formatClassDate(selectedDate).toUpperCase() : "SELECT A DATE"}</Text>
        {selectedClasses.length === 0 ? (
          <Card style={styles.emptyDetailCard}>
            <Text style={styles.errorText}>No classes scheduled.</Text>
          </Card>
        ) : (
          selectedClasses.map((c) => <ClassCard key={c.id} classItem={c} />)
        )}
      </View>
    </View>
  );
}

function confirmLogout(logout: () => void) {
  Alert.alert("Log out?", "You'll need to sign in again to access classes and members.", [
    { text: "Cancel", style: "cancel" },
    { text: "Log out", style: "destructive", onPress: logout },
  ]);
}

export default function StaffOperationsScreen() {
  const { logout, setViewMode } = useAuth();
  const provisionMemberProfile = useProvisionMemberProfile();
  const { data, isLoading, isError, refetch, isRefetching } = useStaffClasses();
  const [view, setView] = useState<"list" | "calendar">("list");

  async function handleSwitchToMemberView() {
    tapFeedback();
    await provisionMemberProfile.mutateAsync();
    setViewMode("member");
  }
  // Only the first (soonest) date group starts open — otherwise checking
  // tomorrow's roster means scrolling past every class in the next two
  // weeks first. Collapsed groups still show a class count so nothing's
  // hidden, just tucked away until tapped.
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [autoCollapsed, setAutoCollapsed] = useState(false);

  const grouped: { date: string; classes: StaffClassSummary[] }[] = [];
  const classesByDate: Record<string, StaffClassSummary[]> = {};
  if (data) {
    for (const c of data) {
      const group = grouped[grouped.length - 1];
      if (group && group.date === c.date) group.classes.push(c);
      else grouped.push({ date: c.date, classes: [c] });
      (classesByDate[c.date] ??= []).push(c);
    }
  }

  if (!autoCollapsed && grouped.length > 1) {
    setCollapsedDates(new Set(grouped.slice(1).map((g) => g.date)));
    setAutoCollapsed(true);
  }

  function toggleDate(date: string) {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BrandMark height={22} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>Classes</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleSwitchToMemberView} hitSlop={12} disabled={provisionMemberProfile.isPending}>
            {provisionMemberProfile.isPending ? (
              <ActivityIndicator size="small" color={Color.textMuted} />
            ) : (
              <Ionicons name="swap-horizontal-outline" size={22} color={Color.textMuted} />
            )}
          </Pressable>
          <Pressable onPress={() => confirmLogout(logout)} hitSlop={12}>
            <Ionicons name="log-out-outline" size={22} color={Color.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.viewToggle}>
        <Pressable onPress={() => setView("list")} style={[styles.viewToggleButton, view === "list" && styles.viewToggleButtonActive]}>
          <Text style={[styles.viewToggleText, view === "list" && styles.viewToggleTextActive]}>List</Text>
        </Pressable>
        <Pressable onPress={() => setView("calendar")} style={[styles.viewToggleButton, view === "calendar" && styles.viewToggleButtonActive]}>
          <Text style={[styles.viewToggleText, view === "calendar" && styles.viewToggleTextActive]}>Calendar</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load classes.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          {view === "calendar" ? (
            <StaffClassesCalendar classesByDate={classesByDate} />
          ) : grouped.length === 0 ? (
            <View style={styles.centerFill}>
              <Text style={styles.errorText}>No classes scheduled in the next two weeks.</Text>
            </View>
          ) : (
            grouped.map((group) => {
              const collapsed = collapsedDates.has(group.date);
              return (
                <View key={group.date} style={styles.dateGroup}>
                  <Pressable onPress={() => toggleDate(group.date)} style={styles.dateGroupHeader}>
                    <Text style={styles.dateLabel}>{formatClassDate(group.date).toUpperCase()}</Text>
                    <View style={styles.dateGroupRight}>
                      {collapsed ? (
                        <Text style={styles.dateGroupCount}>
                          {group.classes.length} class{group.classes.length === 1 ? "" : "es"}
                        </Text>
                      ) : null}
                      <Ionicons
                        name={collapsed ? "chevron-forward" : "chevron-down"}
                        size={16}
                        color={Color.textFaint}
                      />
                    </View>
                  </Pressable>
                  {!collapsed &&
                    group.classes.map((c) => <ClassCard key={c.id} classItem={c} />)}
                </View>
              );
            })
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
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerLogo: { marginRight: Spacing.sm },
  headerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  headerTitle: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  viewToggle: {
    flexDirection: "row",
    gap: 4,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  viewToggleButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: "center" },
  viewToggleButtonActive: { backgroundColor: Color.surface2 },
  viewToggleText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  viewToggleTextActive: { color: Color.textPrimary },
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
  emptyDetailCard: { alignItems: "center", padding: Spacing.xl },
  dateGroup: { marginBottom: Spacing.lg },
  dateGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  dateGroupRight: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  dateGroupCount: { fontSize: 11, color: Color.textFaint },
  dateLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  classCard: { marginBottom: Spacing.sm, overflow: "hidden" },
  classHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.md },
  classTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  classMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  capacityChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  capacityChipFull: { borderColor: Color.warning, backgroundColor: Color.warningWeak },
  capacityChipText: { fontSize: 11, fontWeight: "700", color: Color.textSecondary, fontVariant: ["tabular-nums"] },
  capacityChipTextFull: { color: Color.warning },
  roster: {
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rosterEmpty: { fontSize: 12, color: Color.textMuted, paddingVertical: Spacing.xs },
  rosterRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.xs },
  rosterRowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  rosterRemoveButton: { paddingLeft: Spacing.sm, paddingVertical: 4 },
  rosterName: { fontSize: 13, color: Color.textPrimary },
  rosterEmail: { fontSize: 11, color: Color.textMuted },
  workoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  workoutButtonText: { fontSize: 12, fontWeight: "600", color: Color.gold },
});
