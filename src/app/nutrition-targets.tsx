import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useNutritionDiary, useMyNutritionTarget, useWeeklyNutritionTargets, type ResolvedNutritionTarget } from "@/lib/queries/nutrition-diary";
import { todayDateString } from "@/lib/workout-formatters";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function shiftDate(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  if (dateISO === shiftDate(today, -1)) return "Yesterday";
  if (dateISO === shiftDate(today, 1)) return "Tomorrow";
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Big MacroFactor-style calorie ring: consumed vs target, fills in from
// empty on mount like the app's existing ReadinessRing.
function CalorieRing({ consumed, target, size = 176 }: { consumed: number; target: number | null; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target && target > 0 ? Math.min(1, consumed / target) : 0;
  const over = target !== null && consumed > target;
  const color = over ? Color.warning : Color.gold;

  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fill.setValue(0);
    Animated.timing(fill, { toValue: pct, duration: 900, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);
  const dashoffset = fill.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        {target !== null && (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c}, ${c}`}
            strokeDashoffset={dashoffset}
          />
        )}
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.ringCenter}>
          <Text style={styles.ringValue}>{consumed}</Text>
          <Text style={styles.ringSuffix}>{target !== null ? `of ${target} kcal` : "kcal logged"}</Text>
        </View>
      </View>
    </View>
  );
}

function MacroBar({ label, consumed, target, tone }: { label: string; consumed: number; target: number | null; tone: string }) {
  const pct = target && target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroLabelRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {consumed}
          {target !== null ? `/${target}g` : "g"}
        </Text>
      </View>
      {target !== null ? (
        <View style={styles.macroTrack}>
          <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: tone }]} />
        </View>
      ) : null}
    </View>
  );
}

function sourceLine(target: ResolvedNutritionTarget): string {
  if (target.mode === "manual") return "Set by your coach.";
  if (target.source === "adaptive") return "Learned from your logged weight and food trend.";
  return "Estimated from your weight and training load — sharpens as you log more.";
}

export default function NutritionTargetsScreen() {
  const router = useRouter();
  const today = todayDateString();
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: dayTarget, isLoading: dayLoading } = useMyNutritionTarget(selectedDate);
  const { data: diary } = useNutritionDiary(selectedDate);
  const { data: week, isLoading: weekLoading } = useWeeklyNutritionTargets(selectedDate);

  const consumed = diary?.totals.calories ?? 0;
  const hasTarget = dayTarget && dayTarget.mode !== "disabled" && dayTarget.calories !== null;

  const weekTotal = useMemo(() => {
    if (!week) return null;
    const withTargets = week.days.filter((d) => d.calories !== null);
    if (withTargets.length === 0) return null;
    return Math.round(withTargets.reduce((sum, d) => sum + (d.calories ?? 0), 0) / withTargets.length);
  }, [week]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Calorie & Macro Targets</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.toggleRow}>
        <Pressable onPress={() => setView("day")} style={[styles.toggleChip, view === "day" && styles.toggleChipActive]}>
          <Text style={[styles.toggleText, view === "day" && styles.toggleTextActive]}>Day</Text>
        </Pressable>
        <Pressable onPress={() => setView("week")} style={[styles.toggleChip, view === "week" && styles.toggleChipActive]}>
          <Text style={[styles.toggleText, view === "week" && styles.toggleTextActive]}>Week</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {view === "day" ? (
          <>
            <View style={styles.dateNavRow}>
              <Pressable onPress={() => setSelectedDate((d) => shiftDate(d, -1))} hitSlop={10} style={styles.dateArrow}>
                <Ionicons name="chevron-back" size={18} color={Color.textSecondary} />
              </Pressable>
              <Text style={styles.dateLabel}>{formatDateLabel(selectedDate, today)}</Text>
              <Pressable onPress={() => setSelectedDate((d) => shiftDate(d, 1))} hitSlop={10} style={styles.dateArrow}>
                <Ionicons name="chevron-forward" size={18} color={Color.textSecondary} />
              </Pressable>
            </View>

            {dayLoading ? (
              <ActivityIndicator color={Color.gold} size="large" style={{ marginTop: Spacing.xxl }} />
            ) : (
              <Card style={styles.dayCard}>
                {dayTarget?.mode === "disabled" ? (
                  <Text style={styles.emptyText}>Your coach has turned off daily targets for now — logging still works.</Text>
                ) : (
                  <>
                    {dayTarget?.fuelDayLabel ? <Text style={styles.fuelDayLabel}>{dayTarget.fuelDayLabel}</Text> : null}
                    <View style={styles.ringWrap}>
                      <CalorieRing consumed={consumed} target={hasTarget ? dayTarget!.calories : null} />
                    </View>
                    {dayTarget && hasTarget ? (
                      <>
                        <Text style={styles.sourceText}>{sourceLine(dayTarget)}</Text>
                        <View style={styles.macroBlock}>
                          <MacroBar label="Protein" consumed={diary?.totals.proteinG ?? 0} target={dayTarget.proteinG} tone={Color.accentData} />
                          <MacroBar label="Carbs" consumed={diary?.totals.carbsG ?? 0} target={dayTarget.carbsG} tone={Color.gold} />
                          <MacroBar label="Fat" consumed={diary?.totals.fatG ?? 0} target={dayTarget.fatG} tone={Color.success} />
                        </View>
                        {dayTarget.notes ? <Text style={styles.notesText}>Coach&apos;s note: {dayTarget.notes}</Text> : null}
                      </>
                    ) : (
                      <Text style={styles.emptyText}>Add your weight in Profile so we can calculate a target.</Text>
                    )}
                  </>
                )}
              </Card>
            )}
          </>
        ) : weekLoading ? (
          <ActivityIndicator color={Color.gold} size="large" style={{ marginTop: Spacing.xxl }} />
        ) : week && week.days.some((d) => d.calories !== null) ? (
          <>
            {weekTotal !== null && (
              <Text style={styles.weekAvgText}>
                ~{weekTotal} kcal/day average this week
                {week.days[0]?.mode === "manual" ? " (set by your coach)" : ""}
              </Text>
            )}
            <View style={styles.weekStrip}>
              {week.days.map((d, i) => {
                const isToday = d.date === today;
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => {
                      setSelectedDate(d.date);
                      setView("day");
                    }}
                    style={[styles.dayChip, isToday && styles.dayChipToday]}
                  >
                    <Text style={[styles.dayChipWeekday, isToday && styles.dayChipTextToday]}>{WEEKDAY_SHORT[i]}</Text>
                    <Text style={[styles.dayChipDate, isToday && styles.dayChipTextToday]}>
                      {new Date(`${d.date}T00:00:00`).getDate()}
                    </Text>
                    {d.calories !== null ? (
                      <>
                        <Text style={[styles.dayChipCalories, isToday && styles.dayChipTextToday]}>{d.calories}</Text>
                        <Text style={styles.dayChipUnit}>kcal</Text>
                      </>
                    ) : (
                      <Text style={styles.dayChipUnit}>—</Text>
                    )}
                    {d.fuelDay ? <View style={[styles.dayChipDot, { backgroundColor: fuelDotColor(d.fuelDay) }]} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Card style={styles.dayCard}>
            <Text style={styles.emptyText}>
              {week?.days[0]?.mode === "disabled"
                ? "Your coach has turned off daily targets for now."
                : "Add your weight in Profile so we can calculate your weekly targets."}
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function fuelDotColor(fuelDay: string): string {
  if (fuelDay === "match") return Color.gold;
  if (fuelDay === "full") return Color.success;
  if (fuelDay === "reduced") return Color.warning;
  return Color.textFaint;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  toggleRow: { flexDirection: "row", gap: Spacing.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  toggleChip: { flex: 1, borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingVertical: 8, alignItems: "center" },
  toggleChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  toggleText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  toggleTextActive: { color: Color.gold },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  dateNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md, marginBottom: Spacing.md },
  dateArrow: { padding: 4 },
  dateLabel: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, minWidth: 140, textAlign: "center" },
  dayCard: { padding: Spacing.lg, alignItems: "center" },
  fuelDayLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: Color.gold, marginBottom: Spacing.sm },
  ringWrap: { marginVertical: Spacing.sm },
  ringCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  ringValue: { fontSize: 32, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  ringSuffix: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  sourceText: { fontSize: 11, color: Color.textFaint, textAlign: "center", marginTop: Spacing.xs },
  macroBlock: { width: "100%", marginTop: Spacing.lg, gap: Spacing.md },
  macroRow: { gap: 4 },
  macroLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  macroLabel: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  macroValue: { fontSize: 12, color: Color.textMuted, fontVariant: ["tabular-nums"] },
  macroTrack: { height: 6, borderRadius: 3, backgroundColor: Color.surface1, overflow: "hidden" },
  macroFill: { height: "100%", borderRadius: 3 },
  notesText: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.md, textAlign: "center", fontStyle: "italic" },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center" },
  weekAvgText: { fontSize: 12, color: Color.textMuted, textAlign: "center", marginBottom: Spacing.md },
  weekStrip: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "center" },
  dayChip: {
    width: "13%",
    minWidth: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  dayChipToday: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  dayChipWeekday: { fontSize: 9, fontWeight: "700", color: Color.textFaint, textTransform: "uppercase" },
  dayChipDate: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  dayChipCalories: { fontSize: 12, fontWeight: "700", color: Color.textPrimary, marginTop: 2, fontVariant: ["tabular-nums"] },
  dayChipUnit: { fontSize: 8, color: Color.textFaint },
  dayChipTextToday: { color: Color.gold },
  dayChipDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
});
