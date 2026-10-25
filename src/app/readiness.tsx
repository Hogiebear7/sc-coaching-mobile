import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { PillButton, RangePills } from "@/components/app/primitives";
import { AppRadius, AppSpace, appValue, readinessColor } from "@/constants/theme";
import { useRecovery } from "@/lib/queries/recovery";
import { makeStyles, useAppTheme } from "@/lib/theme";

const RANGES = ["1W", "1M", "3M", "All"] as const;
const TOP = 12; // headroom so the "100" axis label is not clipped
type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number | null> = { "1W": 7, "1M": 30, "3M": 90, All: null };

function isoToDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function shortDate(iso: string) {
  return isoToDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Readiness chart detail (App v2 prototype): the template every metric will
// share — summary stats, full-width chart with dashed gridlines and a
// right-hand axis, range pills, legend, a tinted explainer, recent entries.
export default function ReadinessScreen() {
  const { colors, data: dc, legacy: Color } = useAppTheme();
  const styles = useStyles();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useRecovery();
  const [range, setRange] = useState<Range>("1M");

  const points = useMemo(() => {
    const logs = (data?.logs ?? [])
      .filter((l) => l.readinessScore !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const days = RANGE_DAYS[range];
    if (days === null || !data) return logs;
    const cutoff = isoToDate(data.todayISO);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    return logs.filter((l) => isoToDate(l.date) >= cutoff);
  }, [data, range]);

  const scores = points.map((p) => p.readinessScore as number);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const latest = scores.length ? scores[scores.length - 1] : null;
  const change = scores.length > 1 ? scores[scores.length - 1] - scores[0] : null;

  const chartW = width - AppSpace.gutter * 2;
  const chartH = 220;
  const axisW = 30;
  const plotW = chartW - axisW;
  const slot = points.length ? plotW / points.length : plotW;
  const barW = Math.max(3, Math.min(22, slot * 0.6));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.navBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>Readiness</Text>
        <View style={styles.navBtn} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Couldn&apos;t load your check-ins.</Text>
          <PillButton title="Try again" variant="secondary" onPress={() => refetch()} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.stats}>
            <Stat label="Average" value={avg} />
            <Stat label="Latest" value={latest} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>Change</Text>
              <Text style={appValue(30, colors.text)}>
                {change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}
              </Text>
            </View>
          </View>
          <Text style={styles.rangeText}>
            {points.length ? `${shortDate(points[0].date)} – ${shortDate(points[points.length - 1].date)}` : "No check-ins in this range"}
          </Text>

          <View style={styles.chart}>
            <Svg width={chartW} height={chartH + 34}>
              {[0, 50, 100].map((v) => {
                const y = TOP + chartH - (v / 100) * chartH;
                return (
                  <Line key={v} x1={0} x2={plotW} y1={y} y2={y} stroke={Color.borderDefault} strokeWidth={1} strokeDasharray={v === 0 ? undefined : "4 5"} />
                );
              })}
              {[0, 50, 100].map((v) => (
                <SvgText key={`t${v}`} x={chartW - 2} y={TOP + chartH - (v / 100) * chartH + 5} fill={Color.textMuted} fontSize={13} textAnchor="end">
                  {v}
                </SvgText>
              ))}
              {points.map((p, i) => {
                const s = p.readinessScore as number;
                const h = Math.max(4, (s / 100) * chartH);
                return (
                  <Rect key={p.id} x={i * slot + (slot - barW) / 2} y={TOP + chartH - h} width={barW} height={h} rx={Math.min(4, barW / 2)} fill={readinessColor(s, dc, colors.textMuted)} />
                );
              })}
              {points.length > 0 ? (
                <>
                  <SvgText x={0} y={TOP + chartH + 20} fill={Color.textMuted} fontSize={13}>
                    {shortDate(points[0].date)}
                  </SvgText>
                  <SvgText x={plotW} y={TOP + chartH + 20} fill={Color.textMuted} fontSize={13} textAnchor="end">
                    {shortDate(points[points.length - 1].date)}
                  </SvgText>
                </>
              ) : null}
            </Svg>
          </View>

          <RangePills options={RANGES} value={range} onChange={setRange} />

          <View style={styles.legend}>
            <LegendItem color={dc.readinessHigh} label="Ready 60+" />
            <LegendItem color={dc.readinessMid} label="Steady 40–59" />
            <LegendItem color={dc.readinessLow} label="Ease off <40" />
          </View>

          <View style={styles.explainer}>
            <View style={styles.explainerHead}>
              <Ionicons name="bulb-outline" size={22} color={colors.text} />
              <Text style={styles.explainerTitle}>What is readiness?</Text>
            </View>
            <Text style={styles.explainerBody}>
              A score out of 100 from your daily check-in: sleep hours, sleep quality, soreness and fatigue each count
              for up to 25 points. Higher means you&apos;re better recovered to train hard.
            </Text>
          </View>

          <Text style={styles.listTitle}>Check-ins</Text>
          <View style={styles.list}>
            {[...points].reverse().slice(0, 10).map((p, i) => (
              <View key={p.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Text style={styles.rowDate}>{isoToDate(p.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</Text>
                <View style={[styles.dot, { backgroundColor: readinessColor(p.readinessScore, dc, colors.textMuted) }]} />
                <Text style={styles.rowScore}>{p.readinessScore}</Text>
              </View>
            ))}
            {points.length === 0 ? (
              <View style={styles.row}>
                <Text style={styles.muted}>Log a check-in from + to start your trend.</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={appValue(30, colors.text)}>{value ?? "—"}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, dc, Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, height: 56 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navTitle: { fontSize: 20, fontWeight: "600", color: colors.text },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    muted: { fontSize: 15, color: colors.textMuted },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingBottom: 48 },
    stats: { flexDirection: "row", marginTop: 8 },
    statLabel: { fontSize: 15, color: colors.textMuted, marginBottom: 2 },
    rangeText: { marginTop: 6, fontSize: 16, color: colors.textSecondary },
    chart: { marginTop: 20, marginBottom: 20 },
    legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", gap: 10, backgroundColor: colors.surface, borderRadius: AppRadius.card, padding: 16, marginTop: 20 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendText: { fontSize: 14, color: colors.text },
    dot: { width: 10, height: 10, borderRadius: 5 },
    explainer: { marginTop: 12, borderRadius: AppRadius.card, padding: 18, backgroundColor: "rgba(124,207,157,0.16)" },
    explainerHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    explainerTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
    explainerBody: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    listTitle: { marginTop: AppSpace.section, marginBottom: 12, fontSize: 21, fontWeight: "600", color: colors.text },
    list: { backgroundColor: colors.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
    rowDate: { flex: 1, fontSize: 16, color: colors.text },
    rowScore: { fontSize: 17, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"], minWidth: 32, textAlign: "right" },
  })
);
