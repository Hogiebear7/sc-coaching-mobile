import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { useProfile } from "@/lib/queries/profile";
import { COACH_SHARE_UNLOCK_WEEKS, usePregnancyData, useSavePregnancyStatus } from "@/lib/queries/pregnancy";
import { todayDateString } from "@/lib/workout-formatters";
import {
  useCycleData,
  useSaveCyclePrivacy,
  useSaveCycleSettings,
  useSetMenopauseSupport,
  type CycleRegularity,
} from "@/lib/queries/cycle";

const REGULARITY_OPTIONS: CycleRegularity[] = ["Regular", "Irregular", "Unsure"];

function CheckboxRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow}>
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={20}
        color={checked ? Color.gold : Color.textFaint}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        <Text style={styles.checkboxDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

function GuidanceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.guidanceRow}>
      <Text style={styles.guidanceLabel}>{label}</Text>
      <Text style={styles.guidanceValue}>{value}</Text>
    </View>
  );
}

function BulletList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.bulletLabel}>{label}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function MenopauseSection({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.menopauseTitle}>{title}</Text>
      <Text style={styles.menopauseBody}>{body}</Text>
    </View>
  );
}

export default function CycleTrackingScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const eligible = profile?.cycleTrackingEligible ?? false;
  const { data, isLoading, isError, refetch } = useCycleData(eligible);
  const saveSettings = useSaveCycleSettings();
  const savePrivacy = useSaveCyclePrivacy();
  const setMenopause = useSetMenopauseSupport();

  const [lastPeriodStartDate, setLastPeriodStartDate] = useState("");
  const [averageCycleLengthDays, setAverageCycleLengthDays] = useState("");
  const [periodLengthDays, setPeriodLengthDays] = useState("");
  const [regularity, setRegularity] = useState<CycleRegularity | "">("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [shareCurrentPhaseWithCoach, setShareCurrentPhaseWithCoach] = useState(false);
  const [shareExactDatesWithCoach, setShareExactDatesWithCoach] = useState(false);
  const [shareNotesWithCoach, setShareNotesWithCoach] = useState(false);

  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySaved, setPrivacySaved] = useState(false);

  const { data: pregnancy } = usePregnancyData(eligible);
  const savePregnancy = useSavePregnancyStatus();
  const [pregnantToggle, setPregnantToggle] = useState(false);
  const [weeksAlongInput, setWeeksAlongInput] = useState("");
  const [pregnancyError, setPregnancyError] = useState<string | null>(null);
  const [pregnancySaved, setPregnancySaved] = useState(false);
  const [weeksHydrated, setWeeksHydrated] = useState(false);

  useEffect(() => {
    if (!pregnancy || weeksHydrated) return;
    setPregnantToggle(pregnancy.isPregnant);
    if (pregnancy.isPregnant && pregnancy.estimate.weeksPregnant !== null) {
      setWeeksAlongInput(String(pregnancy.estimate.weeksPregnant));
    }
    setWeeksHydrated(true);
  }, [pregnancy, weeksHydrated]);

  useEffect(() => {
    if (!data || hydrated) return;
    setLastPeriodStartDate(data.settings?.lastPeriodStartDate ?? "");
    setAverageCycleLengthDays(data.settings?.averageCycleLengthDays != null ? String(data.settings.averageCycleLengthDays) : "");
    setPeriodLengthDays(data.settings?.periodLengthDays != null ? String(data.settings.periodLengthDays) : "");
    setRegularity(data.settings?.regularity ?? "");
    setPrivateNotes(data.settings?.privateNotes ?? "");
    setShareCurrentPhaseWithCoach(data.privacy?.shareCurrentPhaseWithCoach ?? false);
    setShareExactDatesWithCoach(data.privacy?.shareExactDatesWithCoach ?? false);
    setShareNotesWithCoach(data.privacy?.shareNotesWithCoach ?? false);
    setHydrated(true);
  }, [data, hydrated]);

  async function handleSaveSettings() {
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      await saveSettings.mutateAsync({
        lastPeriodStartDate,
        averageCycleLengthDays,
        periodLengthDays,
        regularity,
        privateNotes,
      });
      setSettingsSaved(true);
    } catch (e) {
      setSettingsError(e instanceof ApiError ? e.message : "Could not save settings.");
    }
  }

  // Quick reset for a cycle that ran shorter or longer than the estimate
  // predicted — one tap logs today as day 1, without walking back through
  // the full settings form. Reuses whatever's currently in the other
  // fields (cycle length, period length, regularity, notes) rather than
  // resetting them, since only the start date actually changed.
  const [beginDayError, setBeginDayError] = useState<string | null>(null);
  async function handleBeginDayOne() {
    setBeginDayError(null);
    setSettingsSaved(false);
    const today = todayDateString();
    try {
      await saveSettings.mutateAsync({
        lastPeriodStartDate: today,
        averageCycleLengthDays,
        periodLengthDays,
        regularity,
        privateNotes,
      });
      setLastPeriodStartDate(today);
      setSettingsSaved(true);
    } catch (e) {
      setBeginDayError(e instanceof ApiError ? e.message : "Could not log day 1.");
    }
  }

  async function handleSavePrivacy() {
    setPrivacyError(null);
    setPrivacySaved(false);
    try {
      await savePrivacy.mutateAsync({ shareCurrentPhaseWithCoach, shareExactDatesWithCoach, shareNotesWithCoach });
      setPrivacySaved(true);
    } catch (e) {
      setPrivacyError(e instanceof ApiError ? e.message : "Could not save sharing preferences.");
    }
  }

  async function handleTogglePregnant(next: boolean) {
    setPregnantToggle(next);
    setPregnancyError(null);
    setPregnancySaved(false);
    if (!next) {
      // Turning off clears the estimate server-side too (route treats
      // isPregnant:false as "clear dueDate/sharing"), so there's nothing
      // stale left behind if they turn it back on later with new numbers.
      try {
        await savePregnancy.mutateAsync({ isPregnant: false, shareWithCoach: false });
        setWeeksAlongInput("");
      } catch (e) {
        setPregnancyError(e instanceof ApiError ? e.message : "Could not update.");
      }
      return;
    }
    // Switching on alone doesn't save yet — needs a weeks-along value first
    // (the form below appears and the member enters it, then taps Save).
  }

  async function handleSaveWeeksAlong() {
    setPregnancyError(null);
    setPregnancySaved(false);
    const weeks = parseInt(weeksAlongInput, 10);
    if (!Number.isFinite(weeks) || weeks < 0 || weeks > 45) {
      setPregnancyError("Enter a valid number of weeks.");
      return;
    }
    try {
      await savePregnancy.mutateAsync({
        isPregnant: true,
        weeksAlong: weeks,
        shareWithCoach: pregnancy?.shareWithCoach ?? false,
      });
      setPregnancySaved(true);
    } catch (e) {
      setPregnancyError(e instanceof ApiError ? e.message : "Could not save.");
    }
  }

  async function handleToggleShareWithCoach(next: boolean) {
    setPregnancyError(null);
    try {
      await savePregnancy.mutateAsync({ isPregnant: true, shareWithCoach: next });
    } catch (e) {
      setPregnancyError(e instanceof ApiError ? e.message : "Could not update sharing.");
    }
  }

  const phase = data?.phaseEstimate;
  const hasPhase = phase && phase.phase !== "Unknown";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Cycle Tracking</Text>
          <View style={{ width: 22 }} />
        </View>

        {!eligible ? (
          <View style={styles.centerFill}>
            <Text style={styles.emptyText}>Cycle tracking is not available for this account.</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Color.gold} size="large" />
          </View>
        ) : isError || !data ? (
          <View style={styles.centerFill}>
            <Text style={styles.emptyText}>Couldn&apos;t load your cycle information.</Text>
            <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              Add your cycle information below. Everything is private by default — you choose what,
              if anything, to share with your coach.
            </Text>
            <View style={styles.wellBox}>
              <Text style={styles.wellText}>
                This information is only used to help personalise your coaching context. It is never
                shared without your explicit permission below.
              </Text>
            </View>

            <Card style={styles.beginDayCard}>
              <View style={styles.beginDayRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.beginDayTitle}>Cycle running early or late?</Text>
                  <Text style={styles.beginDaySub}>
                    If your period starts before or after the estimate above, log today as day 1 to
                    reset it — no need to edit the form below.
                  </Text>
                </View>
                <Button
                  title="Begin day 1"
                  onPress={handleBeginDayOne}
                  loading={saveSettings.isPending}
                  style={styles.beginDayButton}
                />
              </View>
              {beginDayError ? <Text style={styles.error}>{beginDayError}</Text> : null}
            </Card>

            {hasPhase ? (
              <Card style={styles.phaseCard}>
                <View style={styles.phaseHeaderRow}>
                  <Text style={styles.phaseTitle}>Estimated phase: {phase.phaseLabel}</Text>
                  {phase.cycleDay !== null && phase.cycleLength !== null ? (
                    <Text style={styles.phaseDayText}>
                      Day {phase.cycleDay} of {phase.cycleLength}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.phaseExplanation}>{phase.explanation}</Text>
                {phase.confidence === "low" ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      Your cycle regularity is set to irregular or unsure — treat this estimate as a
                      rough reference only. Individual experience varies significantly.
                    </Text>
                  </View>
                ) : null}
                <View style={styles.guidanceWrap}>
                  <GuidanceRow label="TRAINING" value={phase.trainingGuidance} />
                  <GuidanceRow label="INTENSITY" value={phase.intensityGuidance} />
                  <GuidanceRow label="RECOVERY" value={phase.recoveryGuidance} />
                </View>
                <Text style={styles.disclaimer}>
                  Educational guidance only — not medical advice. This estimate is based on the cycle
                  information you have entered and may not reflect your individual experience.
                </Text>
              </Card>
            ) : (
              <Card style={styles.phaseCard}>
                <Text style={styles.phaseTitle}>Estimated phase</Text>
                <Text style={styles.phaseExplanation}>
                  Add your cycle information below to see a phase estimate. All information is
                  private to you.
                </Text>
              </Card>
            )}

            {data.menopauseSupportEnabled ? (
              <Card style={styles.menopauseCard}>
                <View style={styles.menopauseHeaderRow}>
                  <Text style={styles.sectionTitle}>Menopause support</Text>
                  <Text style={styles.menopauseBadge}>Educational content only</Text>
                </View>
                <MenopauseSection
                  title="Strength training"
                  body="After menopause, strength training is one of the most effective tools for preserving muscle mass, maintaining bone density, and supporting metabolic health. Two to three sessions per week with progressive resistance is a strong foundation."
                />
                <MenopauseSection
                  title="Nutrition"
                  body="Protein needs remain high. Adequate calcium and vitamin D support bone health. Consistent meal timing can help stabilise energy levels throughout the day."
                />
                <MenopauseSection
                  title="Recovery"
                  body="Sleep quality can be more disrupted during perimenopause and post-menopause. Active recovery, consistent sleep schedules, and stress management all contribute to better training outcomes."
                />
                <Text style={styles.disclaimer}>
                  This is educational information only. Please speak with a healthcare professional
                  for personal medical guidance.
                </Text>
              </Card>
            ) : null}

            <Text style={styles.sectionLabel}>CYCLE INFORMATION</Text>
            <Card style={styles.formCard}>
              <Text style={styles.formHint}>These details are private to you unless you choose to share them below.</Text>
              <DateField
                label="Last period start date"
                value={lastPeriodStartDate}
                onChange={setLastPeriodStartDate}
                maxDate={new Date().toISOString().slice(0, 10)}
              />
              <TextField
                label="Average cycle length (days)"
                value={averageCycleLengthDays}
                onChangeText={setAverageCycleLengthDays}
                placeholder="e.g. 28"
                keyboardType="number-pad"
              />
              <TextField
                label="Period length (days)"
                value={periodLengthDays}
                onChangeText={setPeriodLengthDays}
                placeholder="e.g. 5"
                keyboardType="number-pad"
              />

              <Text style={styles.label}>Regularity</Text>
              <View style={styles.chipRow}>
                {REGULARITY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setRegularity(opt)}
                    style={[styles.chip, regularity === opt && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, regularity === opt && styles.chipTextActive]}>{opt}</Text>
                  </Pressable>
                ))}
              </View>

              <TextField
                label="Private notes"
                value={privateNotes}
                onChangeText={setPrivateNotes}
                placeholder="Symptoms, patterns, or other notes — visible only to you unless you share notes below"
                multiline
                style={[styles.multiline, { marginTop: Spacing.md }]}
              />

              {settingsError ? <Text style={styles.error}>{settingsError}</Text> : null}
              {settingsSaved && !settingsError ? <Text style={styles.saved}>Cycle settings saved.</Text> : null}

              <Button title="Save settings" onPress={handleSaveSettings} loading={saveSettings.isPending} style={{ marginTop: Spacing.sm }} />
            </Card>

            <Text style={styles.sectionLabel}>COACH SHARING PREFERENCES</Text>
            <Card style={styles.formCard}>
              <Text style={styles.formHint}>
                All options are off by default. Nothing is shared unless you explicitly turn it on.
              </Text>
              <View style={styles.checkboxWrap}>
                <CheckboxRow
                  label="Share approximate cycle phase with coach"
                  description="Your coach will see an estimated cycle day (e.g. 'Approx. day 14 of ~28'). This is an approximation only, not medical information."
                  checked={shareCurrentPhaseWithCoach}
                  onToggle={() => setShareCurrentPhaseWithCoach((v) => !v)}
                />
                <CheckboxRow
                  label="Share last period date with coach"
                  description="Your coach will see the date you entered for your last period start."
                  checked={shareExactDatesWithCoach}
                  onToggle={() => setShareExactDatesWithCoach((v) => !v)}
                />
                <CheckboxRow
                  label="Share private notes with coach"
                  description="Your coach will see the notes you have entered above."
                  checked={shareNotesWithCoach}
                  onToggle={() => setShareNotesWithCoach((v) => !v)}
                />
              </View>

              {privacyError ? <Text style={styles.error}>{privacyError}</Text> : null}
              {privacySaved && !privacyError ? <Text style={styles.saved}>Sharing preferences saved.</Text> : null}

              <Button title="Save sharing preferences" onPress={handleSavePrivacy} loading={savePrivacy.isPending} style={{ marginTop: Spacing.sm }} />
            </Card>

            <Text style={styles.sectionLabel}>PREGNANCY</Text>
            <Card style={styles.formCard}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>I&apos;m currently pregnant</Text>
                  <Text style={styles.settingSub}>
                    Private by default. Turning this on adjusts general training, nutrition, and
                    recovery guidance across the app for your stage of pregnancy.
                  </Text>
                </View>
                <Switch
                  value={pregnantToggle}
                  onValueChange={handleTogglePregnant}
                  trackColor={{ false: Color.surface3, true: Color.gold }}
                  thumbColor={Color.textPrimary}
                  disabled={savePregnancy.isPending}
                />
              </View>

              {pregnantToggle ? (
                <View style={{ marginTop: Spacing.lg }}>
                  <TextField
                    label="How many weeks along are you?"
                    value={weeksAlongInput}
                    onChangeText={setWeeksAlongInput}
                    placeholder="e.g. 8"
                    keyboardType="number-pad"
                  />
                  {pregnancyError ? <Text style={styles.error}>{pregnancyError}</Text> : null}
                  {pregnancySaved && !pregnancyError ? <Text style={styles.saved}>Saved.</Text> : null}
                  <Button
                    title={pregnancy?.isPregnant ? "Update" : "Save"}
                    onPress={handleSaveWeeksAlong}
                    loading={savePregnancy.isPending}
                    style={{ marginTop: Spacing.sm }}
                  />

                  {pregnancy?.isPregnant && pregnancy.estimate.content ? (
                    <View style={styles.pregnancyGuidanceBox}>
                      <View style={styles.phaseHeaderRow}>
                        <Text style={styles.phaseTitle}>{pregnancy.estimate.content.label}</Text>
                        {pregnancy.estimate.weeksPregnant !== null ? (
                          <Text style={styles.phaseDayText}>Week {pregnancy.estimate.weeksPregnant}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.phaseExplanation}>{pregnancy.estimate.content.summary}</Text>

                      <BulletList label="TRAINING — GENERALLY FINE" items={pregnancy.estimate.content.trainingDo} />
                      <BulletList label="TRAINING — AVOID" items={pregnancy.estimate.content.trainingAvoid} />
                      <BulletList label="NUTRITION — PRIORITISE" items={pregnancy.estimate.content.nutritionDo} />
                      <BulletList label="NUTRITION — AVOID" items={pregnancy.estimate.content.nutritionAvoid} />
                      <BulletList label="RECOVERY" items={pregnancy.estimate.content.recoveryDo} />

                      <Text style={styles.disclaimer}>{pregnancy.estimate.disclaimer}</Text>
                    </View>
                  ) : null}

                  {pregnancy?.isPregnant && (pregnancy.estimate.weeksPregnant ?? 0) >= COACH_SHARE_UNLOCK_WEEKS ? (
                    <View style={[styles.settingRow, { paddingHorizontal: 0, marginTop: Spacing.lg }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>Let your coach know</Text>
                        <Text style={styles.settingSub}>
                          Shares only that you&apos;re pregnant and your approximate stage — no dates,
                          no other details.
                        </Text>
                      </View>
                      <Switch
                        value={pregnancy.shareWithCoach}
                        onValueChange={handleToggleShareWithCoach}
                        trackColor={{ false: Color.surface3, true: Color.gold }}
                        thumbColor={Color.textPrimary}
                        disabled={savePregnancy.isPending}
                      />
                    </View>
                  ) : pregnancy?.isPregnant ? (
                    <Text style={styles.formHint}>
                      Once you&apos;re {COACH_SHARE_UNLOCK_WEEKS} weeks along, you&apos;ll be able to
                      choose whether to let your coach know.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </Card>

            <Text style={styles.sectionLabel}>PREFERENCES</Text>
            <Card style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Menopause support information</Text>
                  <Text style={styles.settingSub}>
                    Educational content on strength training, nutrition, and recovery relevant to
                    perimenopause and post-menopause.
                  </Text>
                </View>
                <Switch
                  value={data.menopauseSupportEnabled}
                  onValueChange={(v) => setMenopause.mutate(v)}
                  trackColor={{ false: Color.surface3, true: Color.gold }}
                  thumbColor={Color.textPrimary}
                  disabled={setMenopause.isPending}
                />
              </View>
            </Card>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  intro: { fontSize: 13, color: Color.textMuted, lineHeight: 19 },
  wellBox: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.md,
  },
  wellText: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  beginDayCard: { padding: Spacing.md, marginTop: Spacing.md, borderColor: Color.goldBorder, backgroundColor: Color.goldWeak },
  beginDayRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  beginDayTitle: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  beginDaySub: { fontSize: 11, color: Color.textMuted, marginTop: 2, lineHeight: 15 },
  beginDayButton: { flexShrink: 0 },
  phaseCard: { padding: Spacing.lg, marginTop: Spacing.lg },
  phaseHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 },
  phaseTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  phaseDayText: { fontSize: 12, color: Color.textMuted },
  phaseExplanation: { fontSize: 13, color: Color.textSecondary, marginTop: Spacing.sm, lineHeight: 19 },
  warningBox: {
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.warningWeak,
    backgroundColor: Color.warningWeak,
    padding: Spacing.sm,
  },
  warningText: { fontSize: 11, color: Color.warning, lineHeight: 15 },
  guidanceWrap: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Color.borderSubtle, paddingTop: Spacing.md, gap: Spacing.sm },
  guidanceRow: { flexDirection: "row", gap: Spacing.sm },
  guidanceLabel: { width: 70, fontSize: 10, fontWeight: "700", letterSpacing: 0.4, color: Color.textMuted },
  guidanceValue: { flex: 1, fontSize: 13, color: Color.textPrimary, lineHeight: 18 },
  disclaimer: { fontSize: 10, color: Color.textFaint, marginTop: Spacing.md, lineHeight: 14 },
  menopauseCard: { padding: Spacing.lg, marginTop: Spacing.lg },
  menopauseHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4, marginBottom: Spacing.sm },
  menopauseBadge: { fontSize: 10, color: Color.textFaint },
  menopauseTitle: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  menopauseBody: { fontSize: 12, color: Color.textMuted, marginTop: 2, lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  formCard: { padding: Spacing.lg },
  formHint: { fontSize: 12, color: Color.textMuted, marginBottom: Spacing.md, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 12, fontWeight: "500", color: Color.textMuted },
  chipTextActive: { color: Color.gold },
  multiline: { height: 90, paddingTop: 12, textAlignVertical: "top" },
  checkboxWrap: { gap: Spacing.md },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  checkboxLabel: { fontSize: 13, fontWeight: "500", color: Color.textPrimary },
  checkboxDescription: { fontSize: 11, color: Color.textMuted, marginTop: 2, lineHeight: 15 },
  error: { color: Color.danger, fontSize: 13, marginTop: Spacing.sm },
  saved: { color: Color.success, fontSize: 13, marginTop: Spacing.sm },
  settingsCard: { padding: 0 },
  settingRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.sm },
  settingTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  settingSub: { fontSize: 11, color: Color.textMuted, marginTop: 2, lineHeight: 15 },
  pregnancyGuidanceBox: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
    paddingTop: Spacing.md,
  },
  bulletLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, color: Color.textMuted },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Color.gold, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 12, color: Color.textSecondary, lineHeight: 17 },
});
