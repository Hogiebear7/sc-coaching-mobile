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

// DateField's year picker defaults its upper bound to the current year when
// no maxDate is given — correct for a backward-looking date (DOB, cycle
// start) but wrong here, since a goal target date is always in the future.
// Without this, minDate=today and the missing maxDate both collapse to this
// year, leaving exactly one selectable year. Five years out is generous for
// any realistic body-composition goal without making the picker unwieldy.
function maxGoalDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().slice(0, 10);
}

const DIFFICULTY_COPY: Record<NonNullable<GoalTimelineResult["difficulty"]>, { label: string; color: string }> = {
  comfortable: { label: "Comfortable", color: Color.success },
  challenging: { label: "Challenging", color: Color.warning },
  aggressive: { label: "Aggressive", color: Color.danger },
};

function TimelineSummary({ label, unit, timeline }: { label: string; unit: string; timeline: GoalTimelineResult }) {
  const difficulty = timeline.difficulty ? DIFFICULTY_COPY[timeline.difficulty] : null;
  return (
    <View style={styles.summaryBox}>
      <View style={styles.summaryHeaderRow}>
        <Text style={styles.summaryLabel}>{label}</Text>
        {difficulty ? <Text style={[styles.difficultyText, { color: difficulty.color }]}>{difficulty.label}</Text> : null}
      </View>
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
      {timeline.suggestedDate ? (
        <Text style={styles.summaryText}>
          At a sustainable pace for your training frequency, this goal is realistic by around{" "}
          {formatDateDisplay(timeline.suggestedDate)}.
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

const TRAINING_DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

// Mirrors the web Profile page's GoalTimelineCard — same save form +
// projection display, against the same /api/profile/goal + /goal-timeline
// routes.
export function GoalTimelineCard() {
  const { data, isLoading, refetch } = useGoalTimeline();
  const saveGoal = useSaveGoal();
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [goalBodyFatPct, setGoalBodyFatPct] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!data) return;
    setGoalWeightKg(data.goalWeightKg !== null ? String(data.goalWeightKg) : "");
    setGoalBodyFatPct(data.goalBodyFatPct !== null ? String(data.goalBodyFatPct) : "");
    setGoalTargetDate(data.goalTargetDate ?? "");
    setTrainingDaysPerWeek(data.trainingDaysPerWeek);
  }, [data]);

  function parsedGoals(): { weightVal: number | null; bodyFatVal: number | null } | null {
    const weightVal = goalWeightKg.trim() ? parseFloat(goalWeightKg) : null;
    const bodyFatVal = goalBodyFatPct.trim() ? parseFloat(goalBodyFatPct) : null;
    if (goalWeightKg.trim() && (!Number.isFinite(weightVal) || (weightVal ?? 0) <= 0)) {
      setError("Goal weight must be a positive number.");
      return null;
    }
    if (goalBodyFatPct.trim() && (!Number.isFinite(bodyFatVal) || (bodyFatVal ?? 0) <= 0 || (bodyFatVal ?? 0) > 75)) {
      setError("Goal body fat must be a percentage between 0 and 75.");
      return null;
    }
    if (weightVal === null && bodyFatVal === null) {
      setError("Set a goal weight or body-fat % first.");
      return null;
    }
    return { weightVal, bodyFatVal };
  }

  async function handleSave() {
    setError(null);
    const parsed = parsedGoals();
    if (!parsed) return;
    try {
      await saveGoal.mutateAsync({
        goalWeightKg: parsed.weightVal,
        goalBodyFatPct: parsed.bodyFatVal,
        goalTargetDate: goalTargetDate || null,
        trainingDaysPerWeek,
      });
    } catch {
      setError("Could not save your goal. Please try again.");
    }
  }

  // Primary flow: weight/body-fat goal + training frequency in, a realistic
  // suggested date out — mirrors the web ProfileForm's handleGenerate.
  async function handleGenerate() {
    setError(null);
    const parsed = parsedGoals();
    if (!parsed) return;
    if (trainingDaysPerWeek === null) {
      setError("Choose how many days a week you can train.");
      return;
    }

    setGenerating(true);
    try {
      await saveGoal.mutateAsync({
        goalWeightKg: parsed.weightVal,
        goalBodyFatPct: parsed.bodyFatVal,
        trainingDaysPerWeek,
      });
      const projection = await refetch();
      const suggested =
        projection.data?.weightTimeline?.suggestedDate ?? projection.data?.bodyFatTimeline?.suggestedDate ?? null;
      if (!suggested) {
        setError("Not enough information yet to suggest a date — check your current weight/body-fat is logged.");
        return;
      }
      setGoalTargetDate(suggested);
      await saveGoal.mutateAsync({ goalTargetDate: suggested });
    } catch {
      setError("Could not generate a timeline. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function nudgeDate(days: number) {
    const next = shiftDate(goalTargetDate || todayDateString(), days);
    setGoalTargetDate(next);
    setError(null);
    try {
      await saveGoal.mutateAsync({ goalTargetDate: next });
    } catch {
      setError("Could not update your date. Please try again.");
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Goal timeline</Text>
      <Text style={styles.explainer}>
        Optional. Set a goal and training days, then generate a timeline — your calorie target
        adjusts to match it, capped at a safe rate.
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

      <Text style={[styles.label, { marginTop: Spacing.md }]}>Days per week you can train</Text>
      <View style={styles.chipRow}>
        {TRAINING_DAYS_OPTIONS.map((d) => (
          <Pressable
            key={d}
            onPress={() => setTrainingDaysPerWeek(d)}
            style={[styles.dayChip, trainingDaysPerWeek === d && styles.dayChipActive]}
          >
            <Text style={[styles.dayChipText, trainingDaysPerWeek === d && styles.dayChipTextActive]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <Button
        title={generating ? "Generating…" : "Generate timeline"}
        onPress={handleGenerate}
        loading={generating}
        style={{ marginTop: Spacing.md }}
      />

      <DateField
        label="Target date"
        value={goalTargetDate}
        onChange={setGoalTargetDate}
        minDate={todayDateString()}
        maxDate={maxGoalDate()}
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

      {/* Deliberately a quiet text link, not a Button — Generate timeline is
          the one action this card wants to read as primary. */}
      <Pressable onPress={handleSave} disabled={saveGoal.isPending} style={styles.saveLink} hitSlop={8}>
        <Text style={styles.saveLinkText}>{saveGoal.isPending ? "Saving…" : "Save without generating"}</Text>
      </Pressable>

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
  saveLink: { alignItems: "center", marginTop: Spacing.md, paddingVertical: 8 },
  saveLinkText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  dayChipText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  dayChipTextActive: { color: Color.gold },
  summaryBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.sm,
  },
  summaryHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm },
  summaryLabel: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  difficultyText: { fontSize: 12, fontWeight: "700" },
  summaryText: { fontSize: 12, color: Color.textMuted, marginTop: 4, lineHeight: 17 },
  warningText: { color: Color.warning },
});
