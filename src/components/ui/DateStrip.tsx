import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppRadius } from "@/constants/theme";
import { selectionFeedback } from "@/lib/haptics";
import { makeStyles } from "@/lib/theme";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const PILL_WIDTH = 46;

// Horizontal scrollable day picker — each pill is a local YYYY-MM-DD, with a
// dot for days that have a logged session. Dates are passed in oldest-first;
// the strip auto-scrolls so the selected pill starts visible on mount.
//
// App v2: days are outlined capsules; the selected day is a filled
// primary-ink capsule and today (when not selected) gets a text-colour
// outline, matching WeekStrip on Home.
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
  const styles = useStyles();
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
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {dates.map((date) => {
        const d = new Date(`${date}T00:00:00`);
        const isSelected = date === selectedDate;
        const isToday = date === today;
        return (
          <Pressable
            key={date}
            onPress={() => {
              if (!isSelected) selectionFeedback();
              onSelect(date);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            style={[styles.pill, isToday && styles.pillToday, isSelected && styles.pillActive]}
          >
            <Text style={[styles.weekday, isSelected && styles.textActive]}>{WEEKDAY_LABELS[d.getDay()]}</Text>
            <Text style={[styles.day, isSelected && styles.textActive]}>{d.getDate()}</Text>
            {markedDates.has(date) ? <View style={[styles.markDot, isSelected && styles.markDotActive]} /> : <View style={styles.markDotSpacer} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { gap: 8, paddingVertical: 4 },
    pill: {
      width: PILL_WIDTH,
      height: 64,
      borderRadius: AppRadius.control,
      borderWidth: 1.5,
      borderColor: c.hairline,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    pillToday: { borderColor: c.text },
    pillActive: { borderColor: c.primary, backgroundColor: c.primary },
    weekday: { fontSize: 12, fontWeight: "600", color: c.textMuted },
    day: { fontSize: 17, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    textActive: { color: c.onPrimary },
    markDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.text },
    markDotActive: { backgroundColor: c.onPrimary },
    markDotSpacer: { width: 4, height: 4 },
  })
);
