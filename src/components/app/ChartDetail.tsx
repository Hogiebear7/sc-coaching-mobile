import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { PillButton, RangePills } from "@/components/app/primitives";
import { AppRadius, AppSpace } from "@/constants/theme";
import { smoothTrend } from "@/lib/chart-math";
import { makeStyles, useAppTheme } from "@/lib/theme";

export type ChartPoint = { id: string; date: string; value: number };

const RANGES = ["1W", "1M", "3M", "All"] as const;
type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number | null> = { "1W": 7, "1M": 30, "3M": 90, All: null };
const TOP = 12; // headroom so the top axis label is not clipped

function isoToDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function shortDate(iso: string) {
  return isoToDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// The chart-detail template every metric shares (App v2): summary stats,
// a full-width chart with dashed gridlines and a right-hand axis, range
// pills, legend, a tinted explainer and the recent entries. "bars" suits
// scores and counts; "line" suits continuous values like body weight and
// adds a smoothed trend over the raw readings.
export function ChartDetail({
  title,
  points,
  loading,
  error,
  onRetry,
  kind = "bars",
  unit,
  color,
  colorFor,
  domain,
  format = (v) => String(Math.round(v)),
  legend,
  explainer,
  emptyText,
  action,
  defaultRange = "1M",
}: {
  title: string;
  points: ChartPoint[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  kind?: "bars" | "line";
  unit?: string;
  /** Series colour (bars without colorFor, and the line). */
  color: string;
  /** Per-value colour for bars, e.g. readiness bands. */
  colorFor?: (v: number) => string;
  /** Fixed y-range (e.g. 0–100 for scores); otherwise fitted to the data. */
  domain?: [number, number];
  format?: (v: number) => string;
  legend?: { color: string; label: string; dashed?: boolean }[];
  explainer: { title: string; body: string };
  emptyText: string;
  /** Optional primary action under the list, e.g. "Log a weigh-in". */
  action?: { label: string; onPress: () => void };
  defaultRange?: Range;
}) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<Range>(defaultRange);

  const sorted = useMemo(() => [...points].sort((a, b) => a.date.localeCompare(b.date)), [points]);
  const shown = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (days === null || sorted.length === 0) return sorted;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    return sorted.filter((p) => isoToDate(p.date) >= cutoff);
  }, [sorted, range]);

  const values = shown.map((p) => p.value);
  const trend = useMemo(() => (kind === "line" ? smoothTrend(values) : []), [kind, values]);
  const summary = kind === "line" && trend.length ? trend : values;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const latest = summary.length ? summary[summary.length - 1] : null;
  const change = summary.length > 1 ? summary[summary.length - 1] - summary[0] : null;

  const chartW = width - AppSpace.gutter * 2;
  const chartH = 220;
  const axisW = 40;
  const plotW = chartW - axisW;
  const [lo, hi] = useMemo<[number, number]>(() => {
    if (domain) return domain;
    if (!values.length) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.15, 0.5);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [domain, values]);
  const y = (v: number) => TOP + chartH - ((v - lo) / (hi - lo || 1)) * chartH;
  const ticks = [lo, (lo + hi) / 2, hi];
  const slot = shown.length ? plotW / shown.length : plotW;
  const barW = Math.max(3, Math.min(22, slot * 0.6));
  const xAt = (i: number) => (shown.length > 1 ? (i / (shown.length - 1)) * (plotW - 8) + 4 : plotW / 2);

  let body: ReactNode;
  if (loading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.center}>
        <Text style={styles.muted}>Couldn&apos;t load this right now.</Text>
        <PillButton title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: 16 }} />
      </View>
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.stats}>
          <Stat unit={unit} label="Average" value={avg === null ? "—" : format(avg)} />
          <Stat unit={unit} label={kind === "line" ? "Trend" : "Latest"} value={latest === null ? "—" : format(latest)} />
          <Stat unit={unit} label="Change" value={change === null ? "—" : `${change > 0 ? "+" : ""}${format(change)}`} />
        </View>
        <Text style={styles.rangeText}>
          {shown.length ? `${shortDate(shown[0].date)} – ${shortDate(shown[shown.length - 1].date)}` : "Nothing logged in this range"}
        </Text>

        <View style={styles.chart} accessible accessibilityLabel={`${title} chart, ${shown.length} entries`}>
          <Svg width={chartW} height={chartH + 34}>
            {ticks.map((v, i) => (
              <Line
                key={`g${i}`}
                x1={0}
                x2={plotW}
                y1={y(v)}
                y2={y(v)}
                stroke={colors.hairline}
                strokeWidth={1}
                strokeDasharray={i === 0 ? undefined : "4 5"}
              />
            ))}
            {ticks.map((v, i) => (
              <SvgText key={`t${i}`} x={chartW - 2} y={y(v) + 5} fill={colors.textMuted} fontSize={13} textAnchor="end">
                {format(v)}
              </SvgText>
            ))}

            {kind === "bars"
              ? shown.map((p, i) => {
                  const h = Math.max(4, y(lo) - y(p.value));
                  return (
                    <Rect
                      key={p.id}
                      x={i * slot + (slot - barW) / 2}
                      y={y(lo) - h}
                      width={barW}
                      height={h}
                      rx={Math.min(4, barW / 2)}
                      fill={colorFor ? colorFor(p.value) : color}
                    />
                  );
                })
              : null}

            {kind === "line" && shown.length > 0 ? (
              <>
                <Polyline
                  points={shown.map((p, i) => `${xAt(i)},${y(p.value)}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                />
                <Polyline points={trend.map((v, i) => `${xAt(i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth={3} />
                {trend.map((v, i) => (
                  <Circle key={`d${i}`} cx={xAt(i)} cy={y(v)} r={3.5} fill={colors.bg} stroke={color} strokeWidth={2} />
                ))}
              </>
            ) : null}

            {shown.length > 0 ? (
              <>
                <SvgText x={0} y={TOP + chartH + 22} fill={colors.textMuted} fontSize={13}>
                  {shortDate(shown[0].date)}
                </SvgText>
                <SvgText x={plotW} y={TOP + chartH + 22} fill={colors.textMuted} fontSize={13} textAnchor="end">
                  {shortDate(shown[shown.length - 1].date)}
                </SvgText>
              </>
            ) : null}
          </Svg>
        </View>

        <RangePills options={RANGES} value={range} onChange={setRange} />

        {legend && legend.length ? (
          <View style={styles.legend}>
            {legend.map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[l.dashed ? styles.legendLine : styles.dot, { backgroundColor: l.color }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.explainer, { backgroundColor: `${color}29` }]}>
          <View style={styles.explainerHead}>
            <Ionicons name="bulb-outline" size={22} color={colors.text} />
            <Text style={styles.explainerTitle}>{explainer.title}</Text>
          </View>
          <Text style={styles.explainerBody}>{explainer.body}</Text>
        </View>

        <Text style={styles.listTitle}>Entries</Text>
        <View style={styles.list}>
          {[...shown]
            .reverse()
            .slice(0, 12)
            .map((p, i) => (
              <View key={p.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Text style={styles.rowDate}>
                  {isoToDate(p.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </Text>
                <View style={[styles.dot, { backgroundColor: colorFor ? colorFor(p.value) : color }]} />
                <Text style={styles.rowValue}>
                  {format(p.value)}
                  {unit ? <Text style={styles.rowUnit}> {unit}</Text> : null}
                </Text>
              </View>
            ))}
          {shown.length === 0 ? (
            <View style={styles.row}>
              <Text style={styles.muted}>{emptyText}</Text>
            </View>
          ) : null}
        </View>
        {action ? <PillButton title={action.label} onPress={action.onPress} style={{ marginTop: 20 }} /> : null}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.navBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.navBtn} />
      </View>
      {body}
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const styles = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {unit && value !== "—" ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, height: 56 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navTitle: { fontSize: 20, fontWeight: "600", color: c.text },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    muted: { fontSize: 15, color: c.textMuted },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingBottom: 48 },
    stats: { flexDirection: "row", marginTop: 8 },
    statLabel: { fontSize: 15, color: c.textMuted, marginBottom: 2 },
    statValue: { fontSize: 30, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"] },
    statUnit: { fontSize: 15, fontWeight: "400", color: c.textSecondary },
    rangeText: { marginTop: 6, fontSize: 16, color: c.textSecondary },
    chart: { marginTop: 20, marginBottom: 20 },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-around",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: AppRadius.card,
      padding: 16,
      marginTop: 20,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendText: { fontSize: 14, color: c.text },
    legendLine: { width: 16, height: 3, borderRadius: 2 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    explainer: { marginTop: 12, borderRadius: AppRadius.card, padding: 18 },
    explainerHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    explainerTitle: { fontSize: 18, fontWeight: "600", color: c.text },
    explainerBody: { marginTop: 8, fontSize: 15, lineHeight: 22, color: c.textSecondary },
    listTitle: { marginTop: AppSpace.section, marginBottom: 12, fontSize: 21, fontWeight: "600", color: c.text },
    list: { backgroundColor: c.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    rowDate: { flex: 1, fontSize: 16, color: c.text },
    rowValue: { fontSize: 17, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"], minWidth: 40, textAlign: "right" },
    rowUnit: { fontSize: 14, fontWeight: "400", color: c.textMuted },
  })
);
