import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgramDayCard } from "@/components/ui/ProgramDayCard";
import { Color, Spacing } from "@/constants/theme";
import { useGenerateProgramme, useSaveProgramme, type ProgrammePreview } from "@/lib/queries/programs";

// Review-before-save step for the AI programme builder — nothing is
// persisted until "Save & start this programme" is tapped, and
// "Regenerate" re-rolls with the same brief for free (no second trip
// through workout-generator.tsx). Mirrors the scan-then-review pattern
// already used elsewhere in the app (tracker import) rather than
// committing to a multi-week plan on a single "Generate" tap.
export default function ProgrammePreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ preview: string }>();
  const [preview, setPreview] = useState<ProgrammePreview>(() => JSON.parse(params.preview));
  const [error, setError] = useState<string | null>(null);

  const generateProgramme = useGenerateProgramme();
  const saveProgramme = useSaveProgramme();

  function handleRegenerate() {
    setError(null);
    generateProgramme.mutate(
      {
        goal: preview.aiMeta.goal,
        weeks: preview.totalWeeks as 4 | 8 | 12,
        daysPerWeek: preview.aiMeta.daysPerWeek,
        sessionMinutes: preview.aiMeta.sessionMinutes,
        equipmentSlugs: preview.aiMeta.equipmentSlugs,
        gymProfileId: preview.aiMeta.gymProfileId,
      },
      {
        onSuccess: (next) => setPreview(next),
        onError: (err) => setError(err instanceof Error ? err.message : "Couldn't regenerate right now."),
      }
    );
  }

  function handleSave() {
    setError(null);
    saveProgramme.mutate(preview, {
      onSuccess: () => router.replace("/(tabs)/workouts"),
      onError: (err) => setError(err instanceof Error ? err.message : "Couldn't save the programme right now."),
    });
  }

  const workoutDayCount = preview.days.filter((d) => d.type === "workout").length;
  const busy = generateProgramme.isPending || saveProgramme.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Review Programme</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.summaryCard}>
          <Text style={styles.programName}>{preview.name}</Text>
          <Text style={styles.summaryLine}>
            {preview.aiMeta.splitStyle} · {workoutDayCount} workout day{workoutDayCount === 1 ? "" : "s"}/week ·{" "}
            {preview.totalWeeks} weeks
          </Text>
          <Text style={styles.summaryHint}>
            Exercises stay the same each week; weight and reps adjust automatically based on how you log each cycle.
          </Text>
        </Card>

        {preview.days.map((day) => (
          <Card key={day.id} style={styles.dayCard}>
            <Text style={styles.dayLabel}>{day.label}</Text>
            <ProgramDayCard day={day} />
          </Card>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Save & start this programme" onPress={handleSave} loading={saveProgramme.isPending} style={{ marginTop: Spacing.lg }} />
        <Button
          title="Regenerate"
          variant="secondary"
          onPress={handleRegenerate}
          loading={generateProgramme.isPending}
          disabled={busy}
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>
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
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  summaryCard: { padding: Spacing.md, marginTop: Spacing.md },
  programName: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  summaryLine: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  summaryHint: { fontSize: 12, color: Color.textFaint, marginTop: Spacing.sm, lineHeight: 17 },
  dayCard: { padding: Spacing.md, marginTop: Spacing.sm },
  dayLabel: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
});
