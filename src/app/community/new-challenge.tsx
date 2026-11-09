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
  CHALLENGE_METRICS,
  MAX_CHALLENGE_DAYS,
  MAX_CHALLENGE_TITLE,
  challengeMetricHint,
  challengeMetricLabel,
  validateChallengeForm,
} from "@/lib/community-groups-format";
import { useCreateChallenge, type ChallengeMetric, type ChallengeScope } from "@/lib/queries/community-groups";
import { todayDateString } from "@/lib/workout-formatters";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// A group organiser sets a challenge: a title, what it is scored on, and the dates. Scoring is automatic from the workouts members already log.
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
  const [metric, setMetric] = useState<ChallengeMetric>("volume");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const problem = validateChallengeForm({ title, startDate, endDate }, today);
    setError(problem);
    if (problem) return;
    create.mutate(
      { title: title.trim(), metric, startDate, endDate },
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

      <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
        <TextField
          label="Title"
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, MAX_CHALLENGE_TITLE))}
          placeholder="e.g. November volume"
          returnKeyType="done"
        />

        <Text style={styles.label}>What is it scored on?</Text>
        <View style={styles.chips}>
          {CHALLENGE_METRICS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              style={[styles.chip, metric === m && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: metric === m }}
            >
              <Text style={[styles.chipText, metric === m && styles.chipTextActive]}>{challengeMetricLabel(m)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{challengeMetricHint(metric)} Scores come from workouts members already log.</Text>

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
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { borderRadius: 999, paddingHorizontal: Spacing.md, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    chipActive: { backgroundColor: Color.gold },
    chipText: { fontSize: 14, fontWeight: "600", color: Color.textFaint },
    chipTextActive: { color: Color.goldForeground },
    hint: { fontSize: 13, color: Color.textMuted, lineHeight: 18, marginTop: Spacing.sm, marginBottom: Spacing.md },
    dates: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
    error: { fontSize: 14, color: Color.danger, marginTop: Spacing.sm },
  })
);
