import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgramDayCard } from "@/components/ui/ProgramDayCard";
import { Color, Spacing } from "@/constants/theme";
import {
  useGenerateProgramme,
  useSaveProgramme,
  useSyncProgrammeToWeeklySchedule,
  type ProgrammePreview,
  type TrainingProgram,
} from "@/lib/queries/programs";
import type { TrainingDayOfWeek } from "@/lib/queries/weekly-training";

// Monday-first, same order/labels as weekly-training.tsx's own picker.
const DAY_ORDER: TrainingDayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];
const DAY_ABBR: Record<TrainingDayOfWeek, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

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
  // Set once save succeeds — flips the screen from "review" to "add this
  // to your schedule?" rather than navigating away immediately, since the
  // sync call needs the saved programme's real id.
  const [savedProgram, setSavedProgram] = useState<TrainingProgram | null>(null);
  const workoutDays = preview.days.filter((d) => d.type === "workout");
  const [weekdayMap, setWeekdayMap] = useState<(TrainingDayOfWeek | null)[]>(() => workoutDays.map(() => null));

  const generateProgramme = useGenerateProgramme();
  const saveProgramme = useSaveProgramme();
  const syncSchedule = useSyncProgrammeToWeeklySchedule();

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
        notes: preview.aiMeta.notes,
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
      onSuccess: (res) => setSavedProgram(res.data.program),
      onError: (err) => setError(err instanceof Error ? err.message : "Couldn't save the programme right now."),
    });
  }

  function handleSync() {
    if (!savedProgram || weekdayMap.some((d) => d === null)) return;
    setError(null);
    syncSchedule.mutate(
      { id: savedProgram.id, weekdayMap: weekdayMap as TrainingDayOfWeek[] },
      {
        onSuccess: () => router.replace("/(tabs)/workouts"),
        onError: (err) => setError(err instanceof Error ? err.message : "Couldn't add to your schedule right now."),
      }
    );
  }

  const workoutDayCount = workoutDays.length;
  const busy = generateProgramme.isPending || saveProgramme.isPending;

  if (savedProgram) {
    const allAssigned = weekdayMap.every((d) => d !== null);
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View style={{ width: 22 }} />
          <Text style={styles.headerTitle}>Add to Schedule</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.summaryCard}>
            <Text style={styles.programName}>Programme saved</Text>
            <Text style={styles.summaryHint}>
              Add {savedProgram.name} to your Weekly Schedule so it shows up alongside your bookings for all{" "}
              {preview.totalWeeks} weeks? Pick which day of the week each workout falls on.
            </Text>
          </Card>

          {workoutDays.map((day, i) => (
            <Card key={day.id} style={styles.dayCard}>
              <Text style={styles.dayLabel}>{day.label}</Text>
              <View style={styles.weekdayRow}>
                {DAY_ORDER.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setWeekdayMap((prev) => prev.map((v, idx) => (idx === i ? d : v)))}
                    style={[styles.chip, weekdayMap[i] === d && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, weekdayMap[i] === d && styles.chipTextActive]}>{DAY_ABBR[d]}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Add to schedule"
            onPress={handleSync}
            loading={syncSchedule.isPending}
            disabled={!allAssigned}
            style={{ marginTop: Spacing.lg }}
          />
          <Button
            title="Skip for now"
            variant="secondary"
            onPress={() => router.replace("/(tabs)/workouts")}
            disabled={syncSchedule.isPending}
            style={{ marginTop: Spacing.sm }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

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

        {preview.testCheckpoints && preview.testCheckpoints.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>TEST CHECKPOINTS</Text>
            {preview.testCheckpoints.map((checkpoint) => (
              <Card key={checkpoint.day.id} style={styles.dayCard}>
                <Text style={styles.dayLabel}>
                  Week {checkpoint.weekNumber} · {checkpoint.day.label}
                </Text>
                <ProgramDayCard day={checkpoint.day} />
              </Card>
            ))}
          </>
        ) : null}

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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Color.textFaint,
    letterSpacing: 0.6,
    marginTop: Spacing.lg,
    marginBottom: 2,
  },
  weekdayRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  chipTextActive: { color: Color.gold },
});
