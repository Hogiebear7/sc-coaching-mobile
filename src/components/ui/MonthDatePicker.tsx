import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

// A tap-to-pick month grid for the class editor's Date field — deliberately
// separate from the read-only StaffClassesCalendar on the Classes tab
// (that one plots existing classes per day; this one just picks a single
// ISO date) rather than sharing a component neither use case fully fits.
// Cell widths use flex:1 across a row rather than a `${100/7}%` string,
// which was the source of the calendar-grid rounding bug already known
// elsewhere in this app.
export function MonthDatePicker({
  value,
  onChange,
  minDate,
}: {
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
}) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = value.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const cells = useMemo(() => {
    const result: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = firstWeekday; i > 0; i--) {
      const d = new Date(cursor.year, cursor.month, 1 - i);
      result.push({ iso: isoOf(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({ iso: isoOf(cursor.year, cursor.month, day), day, inMonth: true });
    }
    while (result.length < 42) {
      const last = result[result.length - 1];
      const [y, m, d] = last.iso.split("-").map(Number);
      const next = new Date(y, m - 1, d + 1);
      result.push({ iso: isoOf(next.getFullYear(), next.getMonth(), next.getDate()), day: next.getDate(), inMonth: false });
    }
    return result;
  }, [cursor, firstWeekday, daysInMonth]);

  function prevMonth() {
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  }
  function nextMonth() {
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={prevMonth} hitSlop={12} style={styles.navButton}>
          <Ionicons name="chevron-back" size={16} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{monthLabel}</Text>
        <Pressable onPress={nextMonth} hitSlop={12} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={16} color={Color.textPrimary} />
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
            const disabled = !!minDate && cell.iso < minDate;
            const selected = cell.iso === value;
            return (
              <Pressable
                key={cell.iso}
                disabled={disabled}
                onPress={() => onChange(cell.iso)}
                style={[styles.dayCell, selected && styles.dayCellSelected]}
              >
                <Text
                  style={[
                    styles.dayCellText,
                    !cell.inMonth && styles.dayCellTextOutside,
                    disabled && styles.dayCellTextDisabled,
                    selected && styles.dayCellTextSelected,
                  ]}
                >
                  {cell.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface2,
  },
  title: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  weekRow: { flexDirection: "row" },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "600", color: Color.textFaint, paddingVertical: 4 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: Radius.sm },
  dayCellSelected: { backgroundColor: Color.gold },
  dayCellText: { fontSize: 13, color: Color.textSecondary },
  dayCellTextOutside: { color: Color.textFaint, opacity: 0.5 },
  dayCellTextDisabled: { color: Color.textFaint, opacity: 0.3 },
  dayCellTextSelected: { color: Color.goldForeground, fontWeight: "700" },
});
