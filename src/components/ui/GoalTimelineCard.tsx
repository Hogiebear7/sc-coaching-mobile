import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { DateField, formatDateDisplay } from "@/components/ui/DateField";
import { AppRadius, type AppPalette } from "@/constants/theme";
import { selectionFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useGoalTimeline, useSaveGoal, type GoalTimelineResult } from "@/lib/queries/goal-timeline";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { todayDateString } from "@/lib/workout-formatters";

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// DateField's year picker defaults its upper bound to the current year when
// no maxDate is given — correct for a backward-looking date (DOB, cycle
// start) but wrong here, since a goal target date is always in the future.
// Five years out is generous for any realistic body-composition goal
// without making the picker unwieldy.
function maxGoalDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().slice(0, 10);
}

function weeksUntil(iso: string): number {
  const ms = new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayDateString()}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 3600 * 1000)));
}

function difficultyOf(d: GoalTimelineResult["difficulty"], c: AppPalette): { label: string; color: string } | null {
  if (d === "comfortable") return { label: "Comfortable", color: c.success };
  if (d === "challenging") return { label: "Challenging", color: c.warning };
  if (d === "aggressive") return { label: "Aggressive", color: c.danger };
  return null;
}

const TRAINING_DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

// Goal summary card in the "label · value, then a plain-English paragraph"
// shape, so each number comes with what it means.
function SummaryCard({ label, value, valueColor, children }: { label: string; value: string; valueColor?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHead}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
      <Text style={styles.summaryBody}>{children}</Text>
    </View>
  );
}

function TimelineSummary({ label, unit, timeline }: { label: string; unit: string; timeline: GoalTimelineResult }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const difficulty = difficultyOf(timeline.difficulty, colors);
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.groupTitle}>{label}</Text>
      {timeline.clampedWeeklyRate !== null ? (
        <SummaryCard
          label="Weekly pace"
          value={`${timeline.direction === "lose" ? "−" : "+"}${Math.abs(timeline.clampedWeeklyRate).toFixed(2)}${unit}`}
          valueColor={difficulty?.color}
        >
          {`That's the pace needed to hit your date${difficulty ? ` — ${difficulty.label.toLowerCase()}` : ""}.`}
          {timeline.isAggressive ? " It's faster than a safe pace, so your plan is capped at a safer rate and the date may slip." : ""}
        </SummaryCard>
      ) : null}
      {timeline.suggestedDate ? (
        <SummaryCard label="Sustainable date" value={formatDateDisplay(timeline.suggestedDate)}>
          A realistic date for your training frequency. It&apos;s an optimistic estimate — plan for a few extra weeks, since progress is
          rarely a straight line.
        </SummaryCard>
      ) : null}
      <SummaryCard
        label="On your current trend"
        value={timeline.projectedDateAtCurrentTrend ? formatDateDisplay(timeline.projectedDateAtCurrentTrend) : "—"}
      >
        {timeline.projectedDateAtCurrentTrend
          ? "Where your logged weigh-ins say you're heading if nothing changes."
          : "Keep logging your weight to see a projection based on your actual trend."}
      </SummaryCard>
    </View>
  );
}

// Mirrors the web Profile page's GoalTimelineCard — same save form +
// projection, against the same /api/profile/goal + /goal-timeline routes.
// App v2 layout borrows the "strategy" pattern: consequence tiles up top
// that change with the inputs, then the inputs, then the explained summary.
export function GoalTimelineCard() {
  const styles = useStyles();
  const { colors, data: dc } = useAppTheme();
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
      const suggested = projection.data?.weightTimeline?.suggestedDate ?? projection.data?.bodyFatTimeline?.suggestedDate ?? null;
      if (!suggested) {
        setError("Not enough information yet to suggest a date — check your current weight/body-fat is logged.");
        return;
      }
      setGoalTargetDate(suggested);
      await saveGoal.mutateAsync({ goalTargetDate: suggested });
      successFeedback();
    } catch {
      setError("Could not generate a timeline. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Persists goal weight/body-fat as soon as the member leaves the field.
  // Silently skips an empty or invalid field rather than erroring on blur —
  // the member may still be mid-edit or genuinely means to leave it blank.
  function saveWeightOrBodyFat(field: "weight" | "bodyFat") {
    const raw = field === "weight" ? goalWeightKg : goalBodyFatPct;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parsed = parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    if (field === "bodyFat" && parsed > 75) return;
    saveGoal.mutate(field === "weight" ? { goalWeightKg: parsed } : { goalBodyFatPct: parsed });
  }

  async function nudgeDate(days: number) {
    tapFeedback();
    const next = shiftDate(goalTargetDate || todayDateString(), days);
    setGoalTargetDate(next);
    setError(null);
    try {
      await saveGoal.mutateAsync({ goalTargetDate: next });
    } catch {
      setError("Could not update your date. Please try again.");
    }
  }

  const primary = data?.weightTimeline ?? data?.bodyFatTimeline ?? null;
  const difficulty = primary ? difficultyOf(primary.difficulty, colors) : null;
  const pace = primary?.clampedWeeklyRate ?? null;
  const paceUnit = data?.weightTimeline ? "kg" : "pts";
  const current = data?.currentWeightKg ?? null;
  const goal = data?.goalWeightKg ?? null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Goal timeline</Text>
      <Text style={styles.intro}>
        Optional. Set a goal and your training days, then generate a timeline — your calorie target adjusts to match it, capped at a safe rate.
      </Text>

      {/* Consequence tiles: what the current inputs mean, at a glance */}
      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: `${dc.readinessHigh}26` }]}>
          <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
            {goalTargetDate ? formatDateDisplay(goalTargetDate) : "—"}
          </Text>
          <Text style={styles.tileLabel}>{goalTargetDate ? `target · ${weeksUntil(goalTargetDate)} weeks away` : "target date"}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={[styles.tileValue, difficulty ? { color: difficulty.color } : null]} numberOfLines={1} adjustsFontSizeToFit>
            {pace !== null ? `${primary?.direction === "lose" ? "−" : "+"}${Math.abs(pace).toFixed(2)} ${paceUnit}` : "—"}
          </Text>
          <Text style={styles.tileLabel}>{difficulty ? `per week · ${difficulty.label.toLowerCase()}` : "per week"}</Text>
        </View>
      </View>

      {current !== null && goal !== null ? (
        <View style={styles.journey} accessible accessibilityLabel={`From ${current.toFixed(1)} to ${goal} kilograms`}>
          <View style={[styles.journeyDot, { backgroundColor: dc.weight }]} />
          <Text style={styles.journeyText}>{current.toFixed(1)} kg</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          <Text style={styles.journeyText}>{goal} kg</Text>
          <Text style={styles.journeyGap}>
            {Math.abs(goal - current).toFixed(1)} kg {goal >= current ? "to gain" : "to lose"}
          </Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Goal weight (kg)</Text>
          <TextInput
            value={goalWeightKg}
            onChangeText={setGoalWeightKg}
            onBlur={() => saveWeightOrBodyFat("weight")}
            keyboardType="decimal-pad"
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Goal weight in kilograms"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Goal body fat (%)</Text>
          <TextInput
            value={goalBodyFatPct}
            onChangeText={setGoalBodyFatPct}
            onBlur={() => saveWeightOrBodyFat("bodyFat")}
            keyboardType="decimal-pad"
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Goal body fat percentage"
          />
        </View>
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Days per week you can train</Text>
      <View style={styles.dayRow} accessibilityRole="radiogroup">
        {TRAINING_DAYS_OPTIONS.map((d) => {
          const active = trainingDaysPerWeek === d;
          return (
            <Pressable
              key={d}
              onPress={() => {
                if (!active) selectionFeedback();
                setTrainingDaysPerWeek(d);
                saveGoal.mutate({ trainingDaysPerWeek: d });
              }}
              style={[styles.dayChip, active && styles.dayChipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${d} days a week`}
            >
              <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button title={generating ? "Generating…" : "Generate timeline"} onPress={handleGenerate} loading={generating} style={{ marginTop: 18 }} />

      <DateField
        label="Target date"
        value={goalTargetDate}
        onChange={(iso) => {
          setGoalTargetDate(iso);
          saveGoal.mutate({ goalTargetDate: iso || null });
        }}
        minDate={todayDateString()}
        maxDate={maxGoalDate()}
        style={{ marginTop: 16 }}
      />

      {goalTargetDate ? (
        <View style={styles.nudgeRow}>
          <Pressable onPress={() => nudgeDate(-7)} style={styles.nudge} accessibilityRole="button">
            <Ionicons name="remove" size={16} color={colors.text} />
            <Text style={styles.nudgeText}>1 week sooner</Text>
          </Pressable>
          <Pressable onPress={() => nudgeDate(7)} style={styles.nudge} accessibilityRole="button">
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={styles.nudgeText}>1 week later</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading && data && (data.weightTimeline || data.bodyFatTimeline) ? (
        <View style={{ marginTop: 20, gap: 20 }}>
          {data.weightTimeline ? <TimelineSummary label={`Weight goal · ${data.goalWeightKg} kg`} unit=" kg" timeline={data.weightTimeline} /> : null}
          {data.bodyFatTimeline ? (
            <TimelineSummary label={`Body-fat goal · ${data.goalBodyFatPct}%`} unit=" pts" timeline={data.bodyFatTimeline} />
          ) : null}
        </View>
      ) : !isLoading && data && (data.goalWeightKg !== null || data.goalBodyFatPct !== null) ? (
        <Text style={styles.intro}>Log your weight or body fat to start seeing a projection.</Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16 },
    title: { fontSize: 19, fontWeight: "600", color: c.text },
    intro: { fontSize: 15, color: c.textSecondary, marginTop: 6, lineHeight: 21 },
    tiles: { flexDirection: "row", gap: 10, marginTop: 16 },
    tile: { flex: 1, backgroundColor: c.surfaceHi, borderRadius: AppRadius.inner + 4, padding: 14 },
    tileValue: { fontSize: 22, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    tileLabel: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    journey: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" },
    journeyDot: { width: 8, height: 8, borderRadius: 4 },
    journeyText: { fontSize: 16, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"] },
    journeyGap: { fontSize: 14, color: c.textMuted, marginLeft: 4 },
    inputRow: { flexDirection: "row", gap: 10, marginTop: 18 },
    label: { fontSize: 14, fontWeight: "500", color: c.textSecondary, marginBottom: 6 },
    input: { height: 50, borderRadius: AppRadius.inner + 2, backgroundColor: c.control, paddingHorizontal: 14, fontSize: 16, color: c.text },
    dayRow: { flexDirection: "row", justifyContent: "space-between" },
    dayChip: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    dayChipActive: { backgroundColor: c.primary },
    dayChipText: { fontSize: 16, fontWeight: "600", color: c.text },
    dayChipTextActive: { color: c.onPrimary },
    nudgeRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    nudge: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 44,
      borderRadius: AppRadius.control,
      backgroundColor: c.control,
    },
    nudgeText: { fontSize: 15, fontWeight: "500", color: c.text },
    error: { fontSize: 14, color: c.danger, marginTop: 10 },
    groupTitle: { fontSize: 17, fontWeight: "600", color: c.text },
    summary: { borderRadius: AppRadius.inner + 4, backgroundColor: c.surfaceHi, overflow: "hidden" },
    summaryHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: c.control,
    },
    summaryLabel: { fontSize: 15, fontWeight: "600", color: c.text },
    summaryValue: { fontSize: 15, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] },
    summaryBody: { fontSize: 15, color: c.textSecondary, lineHeight: 21, padding: 14 },
  })
);
