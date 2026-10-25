import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { Card } from "@/components/ui/Card";
import { NutritionPlanPanel } from "@/components/nutrition/NutritionPlanPanel";
import { Collapsible } from "@/components/ui/Collapsible";
import { LiveColor as Color, figure, Radius, Spacing } from "@/constants/theme";
import { useNutritionDiary, useMyNutritionTarget, useWeeklyNutritionTargets, type ResolvedNutritionTarget } from "@/lib/queries/nutrition-diary";
import { selectionFeedback } from "@/lib/haptics";
import { todayDateString } from "@/lib/workout-formatters";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

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
  const styles = useStyles();
  const Color = useLegacyColors();
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target && target > 0 ? Math.min(1, consumed / target) : 0;
  const over = target !== null && consumed > target;
  const color = over ? Color.warning : Color.gold;

  const [fill] = useState(() => new Animated.Value(0));
  useEffect(() => {
    fill.setValue(0);
    Animated.timing(fill, { toValue: pct, duration: 900, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);
  const dashoffset = fill.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={Color.overlayStrong} strokeWidth={stroke} />
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
  const styles = useStyles();
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
  if (target.mode === "manual") return target.setByMember ? "Set by you via the AI Nutrition Coach." : "Set by your coach.";
  if (target.source === "adaptive") return "Learned from your complete food days and weigh-ins.";
  if (target.weekBudgetKcal != null) return "Your share of this week's budget — see This week below.";
  return "Estimated from your weight and training load — sharpens as you log more.";
}

export default function NutritionTargetsScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Calorie and macro targets</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.toggleRow}>
        {(["day", "week"] as const).map((mode) => {
          const active = view === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => {
                if (!active) selectionFeedback();
                setView(mode);
              }}
              style={[styles.toggleChip, active && styles.toggleChipActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{mode === "day" ? "Day" : "Week"}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {view === "day" ? (
          <>
            <View style={styles.dateNavRow}>
              <Pressable onPress={() => setSelectedDate((d) => shiftDate(d, -1))} hitSlop={10} style={styles.dateArrow} accessibilityRole="button" accessibilityLabel="Previous day">
                <Ionicons name="chevron-back" size={18} color={Color.textSecondary} />
              </Pressable>
              <Text style={styles.dateLabel}>{formatDateLabel(selectedDate, today)}</Text>
              <Pressable onPress={() => setSelectedDate((d) => shiftDate(d, 1))} hitSlop={10} style={styles.dateArrow} accessibilityRole="button" accessibilityLabel="Next day">
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
                        {dayTarget.rationale && dayTarget.rationale.length > 0 ? (
                          <Collapsible title="Why this number" style={styles.rationaleBlock}>
                            {dayTarget.rationale.map((line, i) => (
                              <Text key={i} style={styles.rationaleLine}>
                                · {line}
                              </Text>
                            ))}
                          </Collapsible>
                        ) : null}
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
                {week.days[0]?.mode === "manual" ? (week.days[0]?.setByMember ? " (set by you)" : " (set by your coach)") : ""}
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
                        <Text style={[styles.dayChipUnit, isToday && styles.dayChipTextToday]}>kcal</Text>
                      </>
                    ) : (
                      <Text style={[styles.dayChipUnit, isToday && styles.dayChipTextToday]}>—</Text>
                    )}
                    {d.fuelDay ? <View style={[styles.dayChipDot, { backgroundColor: isToday ? Color.goldForeground : fuelDotColor(d.fuelDay) }]} /> : null}
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

        <NutritionPlanPanel target={view === "day" ? dayTarget : (week?.days.find((d) => d.mode === "auto") ?? dayTarget)} />
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

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    toggleRow: { flexDirection: "row", gap: 2, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: 3, borderRadius: Radius.pill, backgroundColor: Color.surface2 },
    toggleChip: { flex: 1, minHeight: 38, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    toggleChipActive: { backgroundColor: Color.gold },
    toggleText: { fontSize: 14, fontWeight: "600", color: Color.textSecondary },
    toggleTextActive: { color: Color.goldForeground },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    dateNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md, marginBottom: Spacing.md },
    dateArrow: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Color.surface2 },
    dateLabel: { fontSize: 17, fontWeight: "600", color: Color.textPrimary, minWidth: 150, textAlign: "center" },
    dayCard: { padding: Spacing.lg, alignItems: "center" },
    fuelDayLabel: { fontSize: 15, fontWeight: "600", color: Color.textSecondary, marginBottom: Spacing.sm },
    ringWrap: { marginVertical: Spacing.sm },
    ringCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
    ringValue: { ...figure(38), color: Color.textPrimary },
    ringSuffix: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    sourceText: { fontSize: 13, color: Color.textFaint, textAlign: "center", marginTop: Spacing.xs },
    macroBlock: { width: "100%", marginTop: Spacing.lg, gap: Spacing.md },
    macroRow: { gap: 4 },
    macroLabelRow: { flexDirection: "row", justifyContent: "space-between" },
    macroLabel: { fontSize: 14, fontWeight: "600", color: Color.textSecondary },
    macroValue: { fontSize: 14, color: Color.textMuted, fontVariant: ["tabular-nums"] },
    macroTrack: { height: 6, borderRadius: 3, backgroundColor: Color.surface1, overflow: "hidden" },
    macroFill: { height: "100%", borderRadius: 3 },
    notesText: { fontSize: 14, color: Color.textMuted, marginTop: Spacing.md, textAlign: "center", fontStyle: "italic" },
    rationaleBlock: { width: "100%", marginTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle, paddingTop: Spacing.sm },
    rationaleLine: { fontSize: 14, color: Color.textMuted, lineHeight: 20, marginTop: 4 },
    emptyText: { fontSize: 15, lineHeight: 21, color: Color.textMuted, textAlign: "center" },
    weekAvgText: { fontSize: 14, color: Color.textMuted, textAlign: "center", marginBottom: Spacing.md },
    weekStrip: { flexDirection: "row", gap: 4 },
    dayChip: {
      flex: 1,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: Color.surface2,
      paddingVertical: Spacing.sm,
      alignItems: "center",
      gap: 2,
    },
    dayChipToday: { backgroundColor: Color.gold },
    dayChipWeekday: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
    dayChipDate: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
    dayChipCalories: { fontSize: 14, fontWeight: "700", color: Color.textPrimary, marginTop: 2, fontVariant: ["tabular-nums"] },
    dayChipUnit: { fontSize: 11, color: Color.textMuted },
    dayChipTextToday: { color: Color.goldForeground },
    dayChipDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  })
);
