import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { TextField } from "@/components/ui/TextField";
import { Spacing } from "@/constants/theme";
import {
  CARDIO_TYPE_OPTIONS,
  CHALLENGE_CATEGORIES,
  CUSTOM_MEASURES,
  MAX_CHALLENGE_DAYS,
  MAX_CHALLENGE_TITLE,
  MAX_CUSTOM_SUBJECT,
  challengeCategoryLabel,
  challengeMetricHint,
  challengeMetricLabel,
  customMeasureInfo,
  customPayload,
  customPreview,
  suggestedCustomTitle,
  validateChallengeForm,
  validateCustomForm,
  type CustomForm,
  type ReadyMetric,
} from "@/lib/community-groups-format";
import { useCreateChallenge, type CustomMeasure, type ChallengeScope } from "@/lib/queries/community-groups";
import { todayDateString } from "@/lib/workout-formatters";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

const EMPTY_CUSTOM: CustomForm = { measure: null, exercise: "", cardioType: null, distanceText: "" };

// Someone sets a challenge: a title, what it is scored on, and the dates. Scoring is automatic from the workouts and cardio members already log.
// "What is it scored on?" starts on "Build your own" (name an exercise or pick an activity, then choose what to measure; the scoring unit follows from what is
// measured, so it can't be mismatched). The ready-made kinds, grouped by Strength, Consistency, Running and Cardio, are below it for a quick pick.
export default function NewChallengeScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  // A group organiser sets a group challenge (groupId); a gym coach or admin sets a gym challenge (scope=gym). The server checks who may.
  const { groupId, scope: scopeParam } = useLocalSearchParams<{ groupId?: string; scope?: string }>();
  const scope: ChallengeScope = scopeParam === "gym" ? { type: "gym" } : { type: "group", id: typeof groupId === "string" ? groupId : "" };
  const create = useCreateChallenge(scope);

  const today = todayDateString();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"ready" | "custom">("custom");
  const [metric, setMetric] = useState<ReadyMetric>("volume");
  const [custom, setCustom] = useState<CustomForm>(EMPTY_CUSTOM);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isCustom = mode === "custom";
  const measure = custom.measure ? customMeasureInfo(custom.measure) : null;
  const suggested = isCustom ? suggestedCustomTitle(custom) : "";

  function pickMeasure(id: CustomMeasure) {
    // Switching between a strength and a cardio measure drops the other side's answers so nothing stale is sent.
    const kind = customMeasureInfo(id).kind;
    setCustom((c) => ({
      measure: id,
      exercise: kind === "strength" ? c.exercise : "",
      cardioType: kind === "cardio" ? c.cardioType : null,
      distanceText: id === "fastest_time" ? c.distanceText : "",
    }));
  }

  function submit() {
    if (isCustom) {
      const customProblem = validateCustomForm(custom);
      if (customProblem) return setError(customProblem);
    }
    const finalTitle = title.trim() || suggested;
    const problem = validateChallengeForm({ title: finalTitle, startDate, endDate }, today);
    setError(problem);
    if (problem) return;
    create.mutate(
      isCustom
        ? { title: finalTitle, metric: "custom", custom: customPayload(custom), startDate, endDate }
        : { title: finalTitle, metric, startDate, endDate },
      {
        onSuccess: () => router.back(),
        onError: (e) => setError(e.message),
      }
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>New challenge</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TextField
          label="Title"
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, MAX_CHALLENGE_TITLE))}
          placeholder={suggested || "e.g. November volume"}
          returnKeyType="done"
        />

        <Text style={styles.label}>What is it scored on?</Text>

        <View style={styles.category}>
          <View style={styles.chips}>
            <Pressable
              onPress={() => setMode("custom")}
              style={[styles.chip, isCustom && styles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isCustom }}
              accessibilityLabel="Build your own challenge"
            >
              <Text style={[styles.chipText, isCustom && styles.chipTextActive]}>Build your own</Text>
            </Pressable>
          </View>
        </View>

        {isCustom ? (
          <View style={styles.builder}>
            <Text style={styles.builderTitle}>Build your own</Text>

            <Text style={styles.label}>What to measure</Text>
            {(["strength", "cardio"] as const).map((kind) => (
              <View key={kind} style={styles.category} accessibilityRole="radiogroup" accessibilityLabel={kind === "strength" ? "Strength" : "Cardio"}>
                <Text style={styles.categoryLabel}>{kind === "strength" ? "Strength (an exercise)" : "Cardio (an activity)"}</Text>
                <View style={styles.chips}>
                  {CUSTOM_MEASURES.filter((m) => m.kind === kind).map((m) => {
                    const selected = custom.measure === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => pickMeasure(m.id)}
                        style={[styles.chip, selected && styles.chipActive]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {measure?.kind === "strength" ? (
              <TextField
                label="Exercise"
                value={custom.exercise}
                onChangeText={(t) => setCustom((c) => ({ ...c, exercise: t.slice(0, MAX_CUSTOM_SUBJECT) }))}
                placeholder="e.g. Front squat"
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            ) : null}

            {measure?.kind === "cardio" ? (
              <>
                <Text style={styles.label}>Activity</Text>
                <View style={[styles.chips, { marginBottom: Spacing.md }]} accessibilityRole="radiogroup" accessibilityLabel="Activity">
                  {CARDIO_TYPE_OPTIONS.map((o) => {
                    const selected = custom.cardioType === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => setCustom((c) => ({ ...c, cardioType: o.id }))}
                        style={[styles.chip, selected && styles.chipActive]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {custom.measure === "fastest_time" ? (
                  <TextField
                    label="Distance (km)"
                    value={custom.distanceText}
                    onChangeText={(t) => setCustom((c) => ({ ...c, distanceText: t.slice(0, 7) }))}
                    placeholder="e.g. 5"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                ) : null}
              </>
            ) : null}

            {measure ? (
              <>
                <Text style={styles.scoredIn}>
                  <Text style={styles.hintStrong}>Scored in: </Text>
                  {measure.scoring}
                </Text>
                <Text style={styles.hint}>{customPreview(custom)}</Text>
              </>
            ) : (
              <Text style={styles.hint}>Pick what to measure, then name the exercise or choose the activity.</Text>
            )}
          </View>
        ) : null}

        <Text style={styles.orLabel}>Or pick a ready-made one</Text>
        {CHALLENGE_CATEGORIES.map((category) => (
          <View key={category.id} style={styles.category} accessibilityRole="radiogroup" accessibilityLabel={category.label}>
            <Text style={styles.categoryLabel}>{category.label}</Text>
            <View style={styles.chips}>
              {category.metrics.map((m) => {
                const selected = !isCustom && metric === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMode("ready");
                      setMetric(m);
                    }}
                    style={[styles.chip, selected && styles.chipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{challengeMetricLabel(m)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {!isCustom ? (
          <Text style={styles.hint}>
            <Text style={styles.hintStrong}>
              {challengeCategoryLabel(metric)}: {challengeMetricLabel(metric)}.
            </Text>{" "}
            {challengeMetricHint(metric)} Scores come from what members already log.
          </Text>
        ) : null}

        <View style={styles.dates}>
          <DateField label="Starts" value={startDate} onChange={setStartDate} minDate={today} style={{ flex: 1 }} />
          <DateField label="Ends" value={endDate} onChange={setEndDate} minDate={startDate || today} style={{ flex: 1 }} />
        </View>
        <Text style={styles.hint}>Up to {MAX_CHALLENGE_DAYS} days long. It can start today or up to 60 days ahead.</Text>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Button title="Start challenge" onPress={submit} loading={create.isPending} style={{ marginTop: Spacing.lg }} />
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    label: { fontSize: 14, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
    orLabel: { fontSize: 14, fontWeight: "500", color: Color.textSecondary, marginTop: Spacing.sm, marginBottom: 6 },
    category: { marginBottom: Spacing.md },
    categoryLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textFaint, textTransform: "uppercase", marginBottom: 6 },
    hintStrong: { fontWeight: "700", color: Color.textSecondary },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { borderRadius: 999, paddingHorizontal: Spacing.md, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    chipActive: { backgroundColor: Color.gold },
    chipText: { fontSize: 14, fontWeight: "600", color: Color.textFaint },
    chipTextActive: { color: Color.goldForeground },
    builder: { backgroundColor: Color.surface1, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md },
    builderTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
    scoredIn: { fontSize: 14, color: Color.textSecondary, lineHeight: 20, marginTop: Spacing.xs },
    hint: { fontSize: 13, color: Color.textMuted, lineHeight: 18, marginTop: Spacing.sm, marginBottom: Spacing.md },
    dates: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
    error: { fontSize: 14, color: Color.danger, marginTop: Spacing.sm },
  })
);
