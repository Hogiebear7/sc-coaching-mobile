import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AppColor, AppRadius, AppSpace, appValue, readinessColor } from "@/constants/theme";

// App v2 building blocks (prototype). See theme.ts "App v2 tokens".

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RoundIconButton({
  icon,
  onPress,
  label,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  badge?: string | null;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.roundBtn}>
      <Ionicons name={icon} size={21} color={AppColor.text} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function PillButton({
  title,
  onPress,
  variant = "primary",
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, primary ? styles.pillPrimary : styles.pillSecondary, pressed && { opacity: 0.85 }, style]}
    >
      <Text style={[styles.pillText, { color: primary ? AppColor.onPrimary : AppColor.text }]}>{title}</Text>
    </Pressable>
  );
}

// Uniform metric card: title, time window, mini chart, hairline, value + unit.
export function MetricTile({
  title,
  window,
  value,
  unit,
  color,
  bars,
  onPress,
  note,
  scale = "zero",
}: {
  title: string;
  window: string;
  value: string | null;
  unit?: string;
  color: string;
  /** Recent values for the mini bar chart; nulls render as empty slots. */
  bars?: (number | null)[];
  onPress?: () => void;
  /** Shown instead of the chart when there is nothing to plot. */
  note?: string;
  /** "range": bars span min→max (for values far from zero, like body weight). */
  scale?: "zero" | "range";
}) {
  const vals = (bars ?? []).filter((b): b is number => b !== null);
  const max = Math.max(1, ...vals);
  const min = vals.length ? Math.min(...vals) : 0;
  const pct = (b: number) =>
    scale === "range" && max > min ? 25 + ((b - min) / (max - min)) * 75 : Math.max(8, (b / max) * 100);
  const body = (
    <>
      <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.tileWindow} numberOfLines={1}>{window}</Text>
      <View style={styles.tileChart}>
        {bars && bars.some((b) => b !== null) ? (
          <View style={styles.miniBars}>
            {bars.map((b, i) => (
              <View key={i} style={styles.miniBarSlot}>
                <View
                  style={[
                    styles.miniBar,
                    b === null
                      ? styles.miniBarEmpty
                      : { height: `${pct(b)}%`, backgroundColor: color, opacity: i === bars.length - 1 ? 1 : 0.55 },
                  ]}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.tileNote} numberOfLines={2}>{note ?? "No data yet"}</Text>
        )}
      </View>
      <View style={styles.tileFoot}>
        <Text style={appValue(24)} numberOfLines={1}>
          {value ?? "—"}
          {unit && value ? <Text style={styles.unit}> {unit}</Text> : null}
        </Text>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={AppColor.textMuted} /> : null}
      </View>
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${value ?? "no data"} ${unit ?? ""}`} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.tile}>{body}</View>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

// 7-day strip: one column per day with a readiness bar; today in a capsule.
export function WeekStrip({ days }: { days: { letter: string; date: number; score: number | null; isToday: boolean }[] }) {
  return (
    <View style={styles.week}>
      {days.map((d) => (
        <View key={`${d.letter}${d.date}`} style={[styles.weekDay, d.isToday && styles.weekToday]}>
          <Text style={[styles.weekLetter, d.isToday && { color: AppColor.text }]}>{d.letter}</Text>
          <View style={styles.weekTrack}>
            {d.score !== null ? (
              <View style={[styles.weekFill, { height: `${Math.max(10, d.score)}%`, backgroundColor: readinessColor(d.score) }]} />
            ) : null}
          </View>
          <Text style={[styles.weekDate, d.isToday && { color: AppColor.text }]}>{d.date}</Text>
        </View>
      ))}
    </View>
  );
}

export function RangePills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.range} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.rangeItem, selected && styles.rangeSelected]}
          >
            <Text style={[styles.rangeText, selected && { color: AppColor.onPrimary }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 21, fontWeight: "600", color: AppColor.text },
  sectionAction: { fontSize: 15, color: AppColor.textSecondary, textDecorationLine: "underline" },

  roundBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: AppColor.control, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: AppColor.brand, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "700", color: AppColor.onPrimary },

  pill: { minHeight: 48, borderRadius: AppRadius.control, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
  pillPrimary: { backgroundColor: AppColor.primary },
  pillSecondary: { backgroundColor: AppColor.control },
  pillText: { fontSize: 16, fontWeight: "600" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: AppSpace.gap },
  tile: { width: "48.6%", backgroundColor: AppColor.surface, borderRadius: AppRadius.card, padding: 16, minHeight: 168 },
  tileTitle: { fontSize: 17, fontWeight: "500", color: AppColor.text },
  tileWindow: { marginTop: 2, fontSize: 14, color: AppColor.textMuted },
  tileChart: { flex: 1, minHeight: 44, justifyContent: "flex-end", marginVertical: 12 },
  tileNote: { fontSize: 13, lineHeight: 18, color: AppColor.textMuted },
  miniBars: { flexDirection: "row", alignItems: "flex-end", height: 40, gap: 4 },
  miniBarSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  miniBar: { width: "100%", borderRadius: 3 },
  miniBarEmpty: { height: 4, backgroundColor: AppColor.hairline },
  tileFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColor.hairline, paddingTop: 10 },
  unit: { fontSize: 15, fontWeight: "400", color: AppColor.textSecondary },

  week: { flexDirection: "row", justifyContent: "space-between" },
  weekDay: { width: 44, alignItems: "center", paddingVertical: 10, borderRadius: 22 },
  weekToday: { borderWidth: 1.5, borderColor: AppColor.text },
  weekLetter: { fontSize: 13, color: AppColor.textMuted, fontWeight: "600" },
  weekTrack: { width: 18, height: 64, borderRadius: 5, backgroundColor: AppColor.control, marginVertical: 8, justifyContent: "flex-end", overflow: "hidden" },
  weekFill: { width: "100%", borderRadius: 5 },
  weekDate: { fontSize: 13, color: AppColor.textMuted, fontVariant: ["tabular-nums"] },

  range: { flexDirection: "row", backgroundColor: AppColor.control, borderRadius: AppRadius.control, padding: 4 },
  rangeItem: { flex: 1, minHeight: 40, borderRadius: AppRadius.control, alignItems: "center", justifyContent: "center" },
  rangeSelected: { backgroundColor: AppColor.primary },
  rangeText: { fontSize: 15, fontWeight: "600", color: AppColor.text },
});
