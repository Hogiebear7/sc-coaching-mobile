import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WeightChangeInsights } from "@/components/ui/WeightChangeInsights";
import { WeightTrendChart } from "@/components/ui/WeightTrendChart";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useBodyWeightLogs, useLogBodyWeight, type BodyWeightLog } from "@/lib/queries/body-weight";
import { todayDateString } from "@/lib/workout-formatters";

type RangeFilter = "month" | "3months" | "6months" | "year" | "all";

const RANGE_LABELS: { value: RangeFilter; label: string }[] = [
  { value: "month", label: "1 month" },
  { value: "3months", label: "3 months" },
  { value: "6months", label: "6 months" },
  { value: "year", label: "1 year" },
  { value: "all", label: "All time" },
];

function applyRangeFilter(logs: BodyWeightLog[], filter: RangeFilter): BodyWeightLog[] {
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

// Mirrors the web profile page's weightChangeSummary — always compares
// against full history (not the active range filter), so it reads as
// "since you started tracking" rather than "since the start of this window".
function changeSummary(logs: BodyWeightLog[]): string | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const delta = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  const since = new Date(`${first.date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (delta === 0) return `No change since your first entry (${since}).`;
  return `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} kg since your first entry (${since}).`;
}

// Shared between the Nutrition tab's "Weight check-in" section and the
// Profile screen's "Body weight" section — same log-form + chart, reused
// rather than duplicated, matching the web app's single body-weight tool.
// `compact` skips the range chips/change-summary for the smaller Nutrition
// placement, since that spot's job is quick logging, not trend review.
export function BodyWeightCard({ compact = false }: { compact?: boolean }) {
  const { data: weightLogs } = useBodyWeightLogs();
  const logWeight = useLogBodyWeight();
  const [logging, setLogging] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [range, setRange] = useState<RangeFilter>("3months");

  const latest = useMemo(
    () => (weightLogs && weightLogs.length > 0 ? [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0] : null),
    [weightLogs],
  );
  const filtered = useMemo(() => applyRangeFilter(weightLogs ?? [], range), [weightLogs, range]);

  async function handleSave() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg <= 0) return;
    await logWeight.mutateAsync({ date: todayDateString(), weightKg: kg });
    tapFeedback();
    setWeightInput("");
    setLogging(false);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.value}>{latest ? `${latest.weightKg} kg` : "—"}</Text>
          <Text style={styles.sub}>{latest ? `Last logged ${latest.date}` : "No check-ins yet"}</Text>
        </View>
        {!logging ? <Button title="Log weight" variant="secondary" onPress={() => setLogging(true)} /> : null}
      </View>

      {logging ? (
        <View style={styles.inputRow}>
          <TextInput
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder="kg"
            placeholderTextColor={Color.textFaint}
            style={styles.input}
            autoFocus
          />
          <Button title="Save" onPress={handleSave} loading={logWeight.isPending} style={{ flex: 1 }} />
        </View>
      ) : null}

      {weightLogs && weightLogs.length > 0 ? (
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

          {!compact && changeSummary(weightLogs) ? <Text style={styles.summary}>{changeSummary(weightLogs)}</Text> : null}

          {(compact ? weightLogs : filtered).length >= 2 ? (
            <View style={{ marginTop: compact ? 0 : Spacing.sm }}>
              <WeightTrendChart logs={compact ? weightLogs : filtered} />
              {!compact ? <WeightChangeInsights logs={weightLogs} /> : null}
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
