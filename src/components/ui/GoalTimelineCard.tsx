import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField, formatDateDisplay } from "@/components/ui/DateField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useGoalTimeline, useSaveGoal, type GoalTimelineResult } from "@/lib/queries/goal-timeline";
import { todayDateString } from "@/lib/workout-formatters";

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function TimelineSummary({ label, unit, timeline }: { label: string; unit: string; timeline: GoalTimelineResult }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {timeline.clampedWeeklyRate !== null ? (
        <Text style={styles.summaryText}>
          Needs about {Math.abs(timeline.clampedWeeklyRate).toFixed(2)}
          {unit}/week {timeline.direction === "lose" ? "off" : "on"} to hit your date.
          {timeline.isAggressive ? (
            <Text style={styles.warningText}>
              {" "}
              That's faster than a safe pace — the plan is capped at a safer rate, so your date may slip.
            </Text>
          ) : null}
        </Text>
      ) : null}
      {timeline.projectedDateAtCurrentTrend ? (
        <Text style={styles.summaryText}>
          At your current logged trend, you're on track for around {formatDateDisplay(timeline.projectedDateAtCurrentTrend)}.
        </Text>
      ) : (
        <Text style={styles.summaryText}>Keep logging to see a projection based on your actual trend.</Text>
      )}
    </View>
  );
}

// Mirrors the web Profile page's GoalTimelineCard — same save form +
// projection display, against the same /api/profile/goal + /goal-timeline
// routes.
export function GoalTimelineCard() {
  const { data, isLoading } = useGoalTimeline();
  const saveGoal = useSaveGoal();
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [goalBodyFatPct, setGoalBodyFatPct] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setGoalWeightKg(data.goalWeightKg !== null ? String(data.goalWeightKg) : "");
    setGoalBodyFatPct(data.goalBodyFatPct !== null ? String(data.goalBodyFatPct) : "");
    setGoalTargetDate(data.goalTargetDate ?? "");
  }, [data]);

  async function handleSave() {
    setError(null);
    const weightVal = goalWeightKg.trim() ? parseFloat(goalWeightKg) : null;
    const bodyFatVal = goalBodyFatPct.trim() ? parseFloat(goalBodyFatPct) : null;
    if (goalWeightKg.trim() && (!Number.isFinite(weightVal) || (weightVal ?? 0) <= 0)) {
      setError("Goal weight must be a positive number.");
      return;
    }
    if (goalBodyFatPct.trim() && (!Number.isFinite(bodyFatVal) || (bodyFatVal ?? 0) <= 0 || (bodyFatVal ?? 0) > 75)) {
      setError("Goal body fat must be a percentage between 0 and 75.");
      return;
    }
    try {
      await saveGoal.mutateAsync({
        goalWeightKg: weightVal,
        goalBodyFatPct: bodyFatVal,
        goalTargetDate: goalTargetDate || null,
      });
    } catch {
      setError("Could not save your goal. Please try again.");
    }
  }

  function nudgeDate(days: number) {
    setGoalTargetDate((prev) => shiftDate(prev || todayDateString(), days));
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Goal timeline</Text>
      <Text style={styles.explainer}>
        Optional. Set a target weight and/or body-fat % with a date, and your daily calorie target
        adjusts to actually aim at it — capped at a safe rate, never chasing an unsafe one.
      </Text>

      <View style={styles.inputRow}>
        <View style={styles.inputCol}>
          <Text style={styles.label}>Goal weight (kg)</Text>
          <TextInput
            value={goalWeightKg}
            onChangeText={setGoalWeightKg}
            keyboardType="decimal-pad"
            placeholder="optional"
            placeholderTextColor={Color.textFaint}
            style={styles.input}
          />
        </View>
        <View style={styles.inputCol}>
          <Text style={styles.label}>Goal body fat (%)</Text>
          <TextInput
            value={goalBodyFatPct}
            onChangeText={setGoalBodyFatPct}
            keyboardType="decimal-pad"
            placeholder="optional"
            placeholderTextColor={Color.textFaint}
            style={styles.input}
          />
        </View>
      </View>

      <DateField
        label="Target date"
        value={goalTargetDate}
        onChange={setGoalTargetDate}
        minDate={todayDateString()}
        style={{ marginTop: Spacing.sm }}
      />

      {goalTargetDate ? (
        <View style={styles.adjustRow}>
          <Text style={styles.adjustLabel}>Adjust:</Text>
          <Pressable onPress={() => nudgeDate(-7)} style={styles.adjustChip}>
            <Text style={styles.adjustChipText}>1 week sooner</Text>
          </Pressable>
          <Pressable onPress={() => nudgeDate(7)} style={styles.adjustChip}>
            <Text style={styles.adjustChipText}>1 week later</Text>
          </Pressable>
        </View>
      ) : null}

      <Button title="Save goal" onPress={handleSave} loading={saveGoal.isPending} style={{ marginTop: Spacing.md }} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading && data && (data.weightTimeline || data.bodyFatTimeline) ? (
        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          {data.weightTimeline ? (
            <TimelineSummary label={`Weight -> ${data.goalWeightKg} kg`} unit=" kg" timeline={data.weightTimeline} />
          ) : null}
          {data.bodyFatTimeline ? (
            <TimelineSummary label={`Body fat -> ${data.goalBodyFatPct}%`} unit=" pts" timeline={data.bodyFatTimeline} />
          ) : null}
        </View>
      ) : !isLoading && data && (data.goalWeightKg !== null || data.goalBodyFatPct !== null) ? (
        <Text style={styles.summaryText}>Log your weight/body-fat to start seeing a projection.</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md },
  title: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  explainer: { fontSize: 12, color: Color.textMuted, marginTop: 4, lineHeight: 17 },
  inputRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  inputCol: { flex: 1 },
  label: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Color.textPrimary,
  },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  adjustLabel: { fontSize: 12, color: Color.textMuted },
  adjustChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  adjustChipText: { fontSize: 12, color: Color.textMuted },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm },
  summaryBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.sm,
  },
  summaryLabel: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  summaryText: { fontSize: 12, color: Color.textMuted, marginTop: 4, lineHeight: 17 },
  warningText: { color: Color.warning },
});
