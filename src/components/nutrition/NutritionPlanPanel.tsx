import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SectionTitle } from "@/components/app/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { AppRadius, AppSpace } from "@/constants/theme";
import { errorFeedback, selectionFeedback, successFeedback } from "@/lib/haptics";
import {
  ACTIVITY_OPTIONS,
  DISTRIBUTION_OPTIONS,
  PACE_CHOICES,
  useNutritionPreferences,
  useSaveNutritionPreferences,
  type CalorieDistribution,
  type NutritionPreferencesInput,
  type ResolvedNutritionTarget,
} from "@/lib/queries/nutrition-diary";
import { makeStyles, useAppTheme } from "@/lib/theme";

const kcal = (n: number) => n.toLocaleString("en-GB");

// Nutrition targets v2: the week's budget and how it's built, plus the three
// things a member can change — how the week is spread, their pace and how
// active they are. Renders nothing for parts the server doesn't support yet
// (a pre-v2 server sends no weekly fields and 404s the preferences route).
export function NutritionPlanPanel({ target }: { target: ResolvedNutritionTarget | null | undefined }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { data: prefs } = useNutritionPreferences();
  const save = useSaveNutritionPreferences();

  const hasWeek = target?.mode === "auto" && target.weekBudgetKcal != null && target.dailyAverageKcal != null;
  if (!hasWeek && !prefs) return null;

  function update(input: NutritionPreferencesInput) {
    save.mutate(input, {
      onSuccess: () => successFeedback(),
      onError: () => errorFeedback(),
    });
  }

  const distribution: CalorieDistribution = target?.distribution ?? prefs?.calorieDistribution ?? "even";
  const locked = prefs?.distributionLocked ?? target?.distributionSource === "coach-locked";
  const pace = prefs?.goalPacePctPerWeek ?? target?.pacePctPerWeek ?? null;

  return (
    <View style={styles.wrap}>
      {hasWeek && target ? (
        <View style={styles.section}>
          <SectionTitle title="This week" />
          <View style={styles.card}>
            <View style={styles.figures}>
              <Figure label="Weekly budget" value={`${kcal(target.weekBudgetKcal!)}`} unit="kcal" />
              <Figure label="Daily average" value={`${kcal(target.dailyAverageKcal!)}`} unit="kcal" />
            </View>
            {target.expenditureKcal != null ? (
              <View style={styles.burnRow}>
                <View style={[styles.statusDot, { backgroundColor: target.expenditureSource === "learned" ? colors.success : colors.warning }]} />
                <Text style={styles.burnText}>
                  Your burn: about {kcal(target.expenditureKcal)} kcal a day ·{" "}
                  {target.expenditureSource === "learned" ? "learned from your logs" : "estimated"}
                </Text>
              </View>
            ) : null}
            {target.expenditureSource === "formula" ? (
              <Text style={styles.note}>
                {target.completeDaysLast14 ?? 0} of the last 14 days counted. Log full days and tap Day complete in your diary,
                and weigh in a few times a week — after about two weeks it learns your real burn.
              </Text>
            ) : null}
            {target.paceLimited ? (
              <View style={styles.notice}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
                <Text style={styles.noticeText}>We&apos;ve slowed your pace to keep your target at a safe level for you.</Text>
              </View>
            ) : null}
            <Text style={styles.footnote}>Reviewed every Monday. Eating over one day is never taken off the next.</Text>
          </View>
        </View>
      ) : null}

      {prefs ? (
        <>
          <View style={styles.section}>
            <SectionTitle title="Calorie distribution" />
            {locked ? (
              <View style={[styles.card, styles.lockedRow]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{DISTRIBUTION_OPTIONS.find((o) => o.value === distribution)?.label}</Text>
                  <Text style={styles.rowSub}>Set by your coach</Text>
                </View>
              </View>
            ) : (
              <>
                <Segmented
                  options={DISTRIBUTION_OPTIONS.map((o) => o.value)}
                  value={distribution}
                  onChange={(v) => v !== distribution && update({ calorieDistribution: v })}
                  format={(v) => DISTRIBUTION_OPTIONS.find((o) => o.value === v)!.label}
                />
                <Text style={styles.helper}>
                  {DISTRIBUTION_OPTIONS.find((o) => o.value === distribution)?.detail} Your weekly total stays the same. Changes
                  apply from tomorrow.
                </Text>
              </>
            )}
          </View>

          <View style={styles.section}>
            <SectionTitle title="Weekly pace" />
            <View style={styles.chips}>
              {PACE_CHOICES.map((c) => {
                const active = pace === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => {
                      if (active) return;
                      selectionFeedback();
                      update({ goalPacePctPerWeek: c.value });
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${c.label}, ${c.value === 0 ? "maintain weight" : `${c.value > 0 ? "gain" : "lose"} ${Math.abs(c.value)}% of bodyweight a week`}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                    {c.value !== 0 ? (
                      <Text style={[styles.chipSub, active && styles.chipTextActive]}>
                        {c.value > 0 ? "+" : "−"}
                        {Math.abs(c.value)}%/wk
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helper}>% of your bodyweight per week. The app never goes below a safe minimum for you.</Text>
          </View>

          <View style={styles.section}>
            <SectionTitle title="Outside training" />
            <View style={styles.list}>
              {ACTIVITY_OPTIONS.map((o, i) => {
                const active = prefs.activityLevel === o.value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      if (active) return;
                      selectionFeedback();
                      update({ activityLevel: o.value });
                    }}
                    style={({ pressed }) => [styles.listRow, i > 0 && styles.listDivider, pressed && { opacity: 0.8 }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{o.label}</Text>
                      <Text style={styles.rowSub}>{o.detail}</Text>
                    </View>
                    <Ionicons
                      name={active ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={active ? colors.text : colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helper}>Sets your starting burn until the app has learned it from your logs.</Text>
          </View>

          {save.isError ? <Text style={styles.error}>{save.error?.message ?? "Couldn't save that — try again."}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit: string }) {
  const styles = useStyles();
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value} ${unit}`}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue}>
        {value}
        <Text style={styles.figureUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { marginTop: AppSpace.section },
    section: { marginBottom: AppSpace.section },
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16 },
    figures: { flexDirection: "row", gap: 12 },
    figureLabel: { fontSize: 14, color: c.textMuted },
    figureValue: { fontSize: 26, fontWeight: "500", color: c.text, fontVariant: ["tabular-nums"], marginTop: 2 },
    figureUnit: { fontSize: 15, fontWeight: "400", color: c.textMuted },
    burnRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    burnText: { flex: 1, fontSize: 15, color: c.text },
    note: { fontSize: 14, lineHeight: 20, color: c.textMuted, marginTop: 8 },
    notice: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.control },
    noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: c.text },
    footnote: { fontSize: 13, color: c.textMuted, marginTop: 12 },
    helper: { fontSize: 14, lineHeight: 20, color: c.textMuted, marginTop: 10 },
    lockedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    rowTitle: { fontSize: 16, fontWeight: "500", color: c.text },
    rowSub: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: c.control, justifyContent: "center" },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 15, fontWeight: "600", color: c.text },
    chipSub: { fontSize: 12, color: c.textMuted, marginTop: 1, fontVariant: ["tabular-nums"] },
    chipTextActive: { color: c.onPrimary },
    list: { backgroundColor: c.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    listRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
    listDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    error: { fontSize: 14, color: c.danger, marginTop: -8 },
  })
);
