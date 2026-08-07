import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
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
import { useAuth } from "@/lib/auth-context";
import { useMarkAttendance, useStaffClasses, type StaffClassSummary } from "@/lib/queries/staff";

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
  const attended = !!entry.attendedAt;

  return (
    <Pressable
      onPress={() => mark.mutate({ bookingId: entry.bookingId, attended: !attended })}
      disabled={mark.isPending}
      style={styles.rosterRow}
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
  );
}

function ClassCard({ classItem }: { classItem: StaffClassSummary }) {
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
        </View>
      ) : null}
    </Card>
  );
}

export default function StaffOperationsScreen() {
  const { logout } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useStaffClasses();

  const grouped: { date: string; classes: StaffClassSummary[] }[] = [];
  if (data) {
    for (const c of data) {
      const group = grouped[grouped.length - 1];
      if (group && group.date === c.date) group.classes.push(c);
      else grouped.push({ date: c.date, classes: [c] });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Classes</Text>
        <Ionicons name="log-out-outline" size={22} color={Color.textMuted} onPress={logout} suppressHighlighting />
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
          {grouped.length === 0 ? (
            <View style={styles.centerFill}>
              <Text style={styles.errorText}>No classes scheduled in the next two weeks.</Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{formatClassDate(group.date).toUpperCase()}</Text>
                {group.classes.map((c) => (
                  <ClassCard key={c.id} classItem={c} />
                ))}
              </View>
            ))
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
  headerTitle: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  dateGroup: { marginBottom: Spacing.lg },
  dateLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
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
  rosterRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.xs },
  rosterName: { fontSize: 13, color: Color.textPrimary },
  rosterEmail: { fontSize: 11, color: Color.textMuted },
});
