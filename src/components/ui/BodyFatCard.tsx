import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WeightTrendChart } from "@/components/ui/WeightTrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useBodyFatLogs, useLogBodyFat, type BodyFatLog } from "@/lib/queries/body-fat";
import { todayDateString } from "@/lib/workout-formatters";

// Mirrors BodyWeightCard.tsx exactly — same range-filter/change-summary/
// chart trio, applied to BodyFatLogRecord instead. See that file for the
// `compact` prop's rationale.
type RangeFilter = "month" | "3months" | "6months" | "year" | "all";

const RANGE_LABELS: { value: RangeFilter; label: string }[] = [
  { value: "month", label: "1 month" },
  { value: "3months", label: "3 months" },
  { value: "6months", label: "6 months" },
  { value: "year", label: "1 year" },
  { value: "all", label: "All time" },
];

function applyRangeFilter(logs: BodyFatLog[], filter: RangeFilter): BodyFatLog[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  if (filter === "all") return sorted;
  const cutoff = new Date();
  if (filter === "month") cutoff.setMonth(cutoff.getMonth() - 1);
  if (filter === "3months") cutoff.setMonth(cutoff.getMonth() - 3);
  if (filter === "6months") cutoff.setMonth(cutoff.getMonth() - 6);
  if (filter === "year") cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sorted.filter((l) => l.date >= cutoffStr);
}

function changeSummary(logs: BodyFatLog[]): string | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const delta = Math.round((latest.bodyFatPct - first.bodyFatPct) * 10) / 10;
  const since = new Date(`${first.date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (delta === 0) return `No change since your first entry (${since}).`;
  return `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} pts since your first entry (${since}).`;
}

export function BodyFatCard({ compact = false }: { compact?: boolean }) {
  const { data: fatLogs } = useBodyFatLogs();
  const logFat = useLogBodyFat();
  const [logging, setLogging] = useState(false);
  const [pctInput, setPctInput] = useState("");
  const [range, setRange] = useState<RangeFilter>("3months");

  const latest = useMemo(
    () => (fatLogs && fatLogs.length > 0 ? [...fatLogs].sort((a, b) => b.date.localeCompare(a.date))[0] : null),
    [fatLogs],
  );
  const filtered = useMemo(() => applyRangeFilter(fatLogs ?? [], range), [fatLogs, range]);

  async function handleSave() {
    const pct = parseFloat(pctInput);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 75) return;
    await logFat.mutateAsync({ date: todayDateString(), bodyFatPct: pct });
    tapFeedback();
    setPctInput("");
    setLogging(false);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.value}>{latest ? `${latest.bodyFatPct}%` : "—"}</Text>
          <Text style={styles.sub}>{latest ? `Last logged ${latest.date}` : "No readings yet"}</Text>
        </View>
        {!logging ? <Button title="Log body fat" variant="secondary" onPress={() => setLogging(true)} /> : null}
      </View>

      {!compact && !latest ? (
        <Text style={styles.explainer}>
          Optional — weight alone can't tell muscle gain from fat loss. Logging body fat %
          (calipers, a smart scale, or a DEXA/InBody scan) lets your plan track body
          composition directly.
        </Text>
      ) : null}

      {logging ? (
        <View style={styles.inputRow}>
          <TextInput
            value={pctInput}
            onChangeText={setPctInput}
            keyboardType="decimal-pad"
            placeholder="%"
            placeholderTextColor={Color.textFaint}
            style={styles.input}
            autoFocus
          />
          <Button title="Save" onPress={handleSave} loading={logFat.isPending} style={{ flex: 1 }} />
        </View>
      ) : null}

      {fatLogs && fatLogs.length > 0 ? (
        <View style={{ marginTop: Spacing.md }}>
          {!compact ? (
            <View style={styles.rangeRow}>
              {RANGE_LABELS.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => setRange(r.value)}
                  style={[styles.rangeChip, range === r.value && styles.rangeChipActive]}
                >
                  <Text style={[styles.rangeChipText, range === r.value && styles.rangeChipTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!compact && changeSummary(fatLogs) ? <Text style={styles.summary}>{changeSummary(fatLogs)}</Text> : null}

          {(compact ? fatLogs : filtered).length >= 2 ? (
            <View style={{ marginTop: compact ? 0 : Spacing.sm }}>
              <WeightTrendChart
                logs={(compact ? fatLogs : filtered).map((l) => ({ date: l.date, value: l.bodyFatPct }))}
                unit="%"
                rawLabel="Reading"
                trendLabel="Trend"
              />
            </View>
          ) : !compact ? (
            <Text style={styles.emptyRange}>
              {filtered.length === 0 ? "No entries in this time range." : "Log at least two entries to see a trend."}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  value: { fontSize: 20, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  sub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  explainer: { fontSize: 11, color: Color.textMuted, marginTop: Spacing.sm, lineHeight: 16 },
  inputRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  input: {
    width: 90,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Color.textPrimary,
  },
  rangeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rangeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  rangeChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  rangeChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  rangeChipTextActive: { color: Color.gold },
  summary: { fontSize: 11, color: Color.textMuted, marginTop: Spacing.sm },
  emptyRange: { fontSize: 12, color: Color.textMuted, textAlign: "center", paddingVertical: 20 },
});
