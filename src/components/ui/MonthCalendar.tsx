import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card";
import { Color, Radius, Spacing } from "@/constants/theme";

// Generic month-grid calendar — extracted from schedule.tsx's
// ScheduleCalendarTab (same visual language: month nav, Mon-first week
// header, 6-week grid with a gold count badge on days that have something)
// so workout-history.tsx and other screens with "browse by date" needs
// don't each hand-roll their own grid. Domain-agnostic: callers pass a
// per-date count map and get a selected-date callback back.
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function MonthCalendar({
  countByDate,
  selectedDate,
  onSelectDate,
}: {
  countByDate: Record<string, number>;
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());

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

  return (
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
          const count = countByDate[cell.iso] ?? 0;
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDate;
          return (
            <Pressable
              key={cell.iso}
              onPress={() => onSelectDate(cell.iso)}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                !isSelected && isToday && styles.dayCellToday,
                !cell.inMonth && styles.dayCellOutside,
              ]}
            >
              <Text style={[styles.dayCellText, isToday && styles.dayCellTextToday]}>{cell.day}</Text>
              {count > 0 ? (
                <View style={styles.dayCellBadge}>
                  <Text style={styles.dayCellBadgeText}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
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
});
