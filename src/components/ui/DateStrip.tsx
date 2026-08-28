import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const PILL_WIDTH = 44;

// Horizontal scrollable day picker (MacroFactor's Workout tab pattern) —
// each pill is a local YYYY-MM-DD, with a dot for days that have a logged
// session. Dates are passed in oldest-first; the strip auto-scrolls so the
// selected pill starts visible on mount.
export function DateStrip({
  dates,
  selectedDate,
  today,
  markedDates,
  onSelect,
}: {
  dates: string[];
  selectedDate: string;
  today: string;
  markedDates: Set<string>;
  onSelect: (date: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const index = dates.indexOf(selectedDate);
    if (index === -1) return;
    const x = Math.max(0, index * (PILL_WIDTH + 8) - 100);
    scrollRef.current?.scrollTo({ x, animated: false });
    // Only scroll into position once per mount — subsequent taps shouldn't jerk the strip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {dates.map((date) => {
        const d = new Date(`${date}T00:00:00`);
        const isSelected = date === selectedDate;
        const isToday = date === today;
        return (
          <Pressable key={date} onPress={() => onSelect(date)} style={[styles.pill, isSelected && styles.pillActive]}>
            <Text style={[styles.weekday, isSelected && styles.weekdayActive]}>{WEEKDAY_LABELS[d.getDay()]}</Text>
            <Text style={[styles.day, isSelected && styles.dayActive]}>{d.getDate()}</Text>
            {isToday && !isSelected ? <View style={styles.todayDot} /> : null}
            {markedDates.has(date) ? <View style={[styles.markDot, isSelected && styles.markDotActive]} /> : <View style={styles.markDotSpacer} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  pill: {
    width: PILL_WIDTH,
    height: 60,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  pillActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  weekday: { fontSize: 10, fontWeight: "600", color: Color.textFaint },
  weekdayActive: { color: Color.gold },
  day: { fontSize: 16, fontWeight: "700", color: Color.textSecondary },
  dayActive: { color: Color.textPrimary },
  todayDot: { position: "absolute", top: 6, right: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: Color.accentData },
  markDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Color.gold },
  markDotActive: { backgroundColor: Color.goldForeground },
  markDotSpacer: { width: 4, height: 4 },
});
