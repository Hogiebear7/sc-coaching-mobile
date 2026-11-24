import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AppRadius, AppSpace, appTitle } from "@/constants/theme";
import { isBatteryOptimizationRelevant, openBatteryOptimizationSettings } from "@/lib/battery-optimization";
import { tapFeedback } from "@/lib/haptics";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { hasActiveRehab, progressText, quickAmounts } from "@/lib/targets/data";
import { progressFor, type Target, type TargetKind } from "@/lib/targets";
import { reminderCoverage } from "@/lib/targets/reminders";
import { useTargets } from "@/lib/targets/store";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function reminderSummary(t: Target): string | null {
  if (!t.reminders) return null;
  const parts: string[] = [];
  if (t.reminders.times?.length) parts.push(`at ${[...t.reminders.times].sort().join(", ")}`);
  if (t.reminders.every) parts.push(`every ${t.reminders.every.minutes >= 60 && t.reminders.every.minutes % 60 === 0 ? `${t.reminders.every.minutes / 60} h` : `${t.reminders.every.minutes} min`}, ${t.reminders.every.start}–${t.reminders.every.end}`);
  if (parts.length === 0) return null;
  const days = t.days && t.days.length > 0 ? ` on ${[...t.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_NAMES[d]).join(", ")}` : "";
  return `Reminders ${parts.join(" and ")}${days}`;
}

export default function TargetsScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: TargetKind = params.kind === "rehab" ? "rehab" : "goal";
  const { loading, targets, entries, state, log, undo } = useTargets();

  const now = new Date();
  const shown = useMemo(() => targets.filter((t) => t.kind === kind), [targets, kind]);
  const anyReminders = shown.some((t) => t.active && t.reminders);
  const coverage = useMemo(() => reminderCoverage({ targets: shown, entries }, new Date()), [shown, entries]);
  const rehabActive = hasActiveRehab(targets);

  const title = kind === "rehab" ? "Rehab" : "Goals";
  const intro =
    kind === "rehab"
      ? "Your rehab exercises and how often to do them. This tracks what you do. It does not replace advice from your physio or doctor."
      : "Set a count for the day, week or month: 500 squats today, 5 sessions this week, 50 km this month. Tap to add what you've done.";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>{intro}</Text>

          {shown.length === 0 ? (
            <Card>
              <View style={styles.empty}>
                <Ionicons name={kind === "rehab" ? "medkit-outline" : "flag-outline"} size={30} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>{kind === "rehab" ? "No rehab plan yet" : "No goals yet"}</Text>
                <Text style={styles.muted}>
                  {kind === "rehab" ? "Add each exercise you've been given, with how many to do and when you'd like a reminder." : "Add your first goal. Keep it small enough to hit."}
                </Text>
              </View>
            </Card>
          ) : (
            shown.map((t) => {
              const p = progressFor(t, entries, now);
              const summary = reminderSummary(t);
              const steps = quickAmounts(t.goalCount);
              return (
                <Card key={t.id} style={!t.active ? styles.paused : undefined}>
                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {t.title}
                      </Text>
                      <Pressable
                        onPress={() => {
                          tapFeedback();
                          router.push({ pathname: "/target-edit", params: { id: t.id } });
                        }}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${t.title}`}
                      >
                        <Ionicons name="create-outline" size={20} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <Text style={styles.muted}>
                      {t.active ? progressText(p.done, p.goal, t.unit, t.period) : "Paused"}
                      {t.active && p.complete ? " · done" : ""}
                    </Text>
                    <ProgressBar pct={p.fraction * 100} color={p.complete ? colors.success : undefined} />
                    {t.notes ? <Text style={styles.note}>{t.notes}</Text> : null}
                    {summary && t.active ? <Text style={styles.note}>{summary}</Text> : null}
                    {t.active ? (
                      <View style={styles.actions}>
                        {steps.map((n) => (
                          <Pressable
                            key={n}
                            onPress={() => {
                              tapFeedback();
                              void log(t.id, n);
                            }}
                            style={styles.chip}
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${n} ${t.unit} to ${t.title}`}
                          >
                            <Text style={styles.chipText}>+{n}</Text>
                          </Pressable>
                        ))}
                        {p.done > 0 ? (
                          <Pressable
                            onPress={() => {
                              tapFeedback();
                              void undo(t.id);
                            }}
                            style={[styles.chip, styles.chipQuiet]}
                            accessibilityRole="button"
                            accessibilityLabel={`Undo last entry for ${t.title}`}
                          >
                            <Text style={styles.chipTextQuiet}>Undo</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}

          <Button
            title={kind === "rehab" ? "Add a rehab exercise" : "Add a goal"}
            onPress={() => router.push({ pathname: "/target-edit", params: { kind } })}
          />

          {anyReminders ? (
            <View style={styles.noteBlock}>
              <Text style={styles.muted}>
                {coverage.lastDay
                  ? `Reminders are set up to ${coverage.lastDay.toLocaleDateString("en-IE", { weekday: "long" })}${coverage.capped ? " (your phone limits how many it can hold)" : ""}. Open the app at least once a week to keep them topped up.`
                  : "Reminders are set for later days. Open the app at least once a week to keep them topped up."}
              </Text>
              {isBatteryOptimizationRelevant() ? (
                <Pressable onPress={() => void openBatteryOptimizationSettings()} accessibilityRole="button" style={styles.linkRow}>
                  <Ionicons name="battery-charging-outline" size={18} color={colors.text} />
                  <Text style={styles.link}>Reminders late or missing? Turn off battery optimisation for this app</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {kind === "goal" ? (
            <Pressable
              onPress={() => router.push({ pathname: "/targets", params: { kind: "rehab" } })}
              style={styles.linkRow}
              accessibilityRole="button"
            >
              <Ionicons name="medkit-outline" size={18} color={colors.text} />
              <Text style={styles.link}>{rehabActive ? "Open my rehab plan" : "Start a rehab plan"}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.replace({ pathname: "/targets", params: { kind: "goal" } })} style={styles.linkRow} accessibilityRole="button">
              <Ionicons name="flag-outline" size={18} color={colors.text} />
              <Text style={styles.link}>Open my goals</Text>
            </Pressable>
          )}
          {state.targets.length === 0 ? null : <View style={{ height: 8 }} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: AppSpace.gutter, paddingVertical: 8 },
    back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { ...appTitle(20, c.text), fontSize: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { padding: AppSpace.gutter, gap: AppSpace.gap, paddingBottom: 48 },
    intro: { color: c.textSecondary, fontSize: 15, lineHeight: 21, marginBottom: 4 },
    muted: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    empty: { alignItems: "center", gap: 8, padding: 20 },
    emptyTitle: { color: c.text, fontSize: 17, fontWeight: "700" },
    cardBody: { padding: 16, gap: 10 },
    titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    cardTitle: { flex: 1, color: c.text, fontSize: 17, fontWeight: "700" },
    note: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
    paused: { opacity: 0.55 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    chip: { backgroundColor: c.primary, borderRadius: AppRadius.control, paddingHorizontal: 16, paddingVertical: 9, minWidth: 54, alignItems: "center" },
    chipText: { color: c.onPrimary, fontSize: 15, fontWeight: "700" },
    chipQuiet: { backgroundColor: c.control },
    chipTextQuiet: { color: c.text, fontSize: 15, fontWeight: "600" },
    noteBlock: { gap: 10, marginTop: 6 },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
    link: { color: c.text, fontSize: 14, fontWeight: "600", flexShrink: 1, textDecorationLine: "underline" },
  }),
);
