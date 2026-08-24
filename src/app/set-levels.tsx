import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SECTION_LABELS } from "@/components/ui/ExerciseAutocomplete";
import { MuscleSetLevelDiagram } from "@/components/ui/MuscleSetLevels";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/lib/queries/workouts";
import { todayDateString } from "@/lib/workout-formatters";
import { computeMuscleSetLevels, SET_LEVEL_SECTIONS, type SetLevelTier } from "@/lib/workout-set-levels";

const WINDOW_OPTIONS: { days: number; label: string }[] = [
  { days: 7, label: "1 week" },
  { days: 28, label: "4 weeks" },
];

const TIER_LABEL: Record<SetLevelTier, string> = { none: "None", low: "Low", moderate: "Moderate", high: "High" };
const TIER_DOT_OPACITY: Record<Exclude<SetLevelTier, "none">, number> = { low: 0.38, moderate: 0.68, high: 1 };

export default function SetLevelsScreen() {
  const router = useRouter();
  const { data, isLoading } = useWorkouts();
  const [windowDays, setWindowDays] = useState(7);

  const sectionByExerciseId = useMemo(
    () => new Map((data?.exerciseLibrary ?? []).map((e) => [e.id, e.section])),
    [data]
  );

  const { levels, sessionsInWindow, resolvedSessions } = useMemo(
    () => computeMuscleSetLevels(data?.sessions ?? [], sectionByExerciseId, windowDays, todayDateString()),
    [data, sectionByExerciseId, windowDays]
  );

  const totalSets = SET_LEVEL_SECTIONS.reduce((sum, s) => sum + levels[s].weeklySets, 0);
  const unresolvedSessions = sessionsInWindow - resolvedSessions;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Set Levels</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>Average weekly sets by muscle group, from exercises picked off the library.</Text>

          <View style={styles.windowRow}>
            {WINDOW_OPTIONS.map((opt) => (
              <Pressable
                key={opt.days}
                onPress={() => setWindowDays(opt.days)}
                style={[styles.windowChip, windowDays === opt.days && styles.windowChipActive]}
              >
                <Text style={[styles.windowChipText, windowDays === opt.days && styles.windowChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {totalSets === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {sessionsInWindow === 0 ? "No sessions logged in this window" : "No library-linked sets in this window"}
              </Text>
              <Text style={styles.emptyBody}>
                {sessionsInWindow === 0
                  ? "Log a session to start seeing your set levels."
                  : "Pick exercises from the library when logging to track them here — free-text entries aren't matched to a muscle group."}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.diagramCard}>
                <MuscleSetLevelDiagram levels={levels} height={176} />

                <View style={styles.legendRow}>
                  {(["low", "moderate", "high"] as const).map((tier) => (
                    <View key={tier} style={styles.legendItem}>
                      <View style={[styles.legendDot, { opacity: TIER_DOT_OPACITY[tier] }]} />
                      <Text style={styles.legendText}>{TIER_LABEL[tier]}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionList}>
                {SET_LEVEL_SECTIONS.map((section) => (
                  <View key={section} style={styles.sectionRow}>
                    <Text style={styles.sectionLabel}>{SECTION_LABELS[section]}</Text>
                    <View style={styles.sectionMeta}>
                      <Text style={styles.sectionSets}>{levels[section].weeklySets} sets/wk</Text>
                      <View style={[styles.tierBadge, tierBadgeStyle(levels[section].tier)]}>
                        <Text style={[styles.tierBadgeText, tierTextStyle(levels[section].tier)]}>
                          {TIER_LABEL[levels[section].tier]}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {unresolvedSessions > 0 ? (
                <Text style={styles.unresolvedNote}>
                  {unresolvedSessions} of {sessionsInWindow} session{sessionsInWindow === 1 ? "" : "s"} in this window had
                  no library-linked exercises and aren&apos;t reflected above.
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function tierBadgeStyle(tier: SetLevelTier) {
  switch (tier) {
    case "high":
      return { backgroundColor: "rgba(85,196,254,0.2)" };
    case "moderate":
      return { backgroundColor: "rgba(85,196,254,0.12)" };
    case "low":
      return { backgroundColor: "rgba(255,255,255,0.06)" };
    default:
      return { backgroundColor: "rgba(255,255,255,0.03)" };
  }
}

function tierTextStyle(tier: SetLevelTier) {
  if (tier === "high" || tier === "moderate") return { color: Color.accentData };
  if (tier === "low") return { color: Color.textMuted };
  return { color: Color.textFaint };
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
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  intro: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  windowRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginTop: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    padding: 2,
  },
  windowChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  windowChipActive: { backgroundColor: "rgba(85,196,254,0.15)" },
  windowChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  windowChipTextActive: { color: Color.accentData },
  emptyCard: {
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, textAlign: "center" },
  emptyBody: { fontSize: 12, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xs, lineHeight: 17 },
  diagramCard: {
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
    alignItems: "center",
  },
  legendRow: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: Radius.pill, backgroundColor: Color.accentData },
  legendText: { fontSize: 10, color: Color.textMuted },
  sectionList: { marginTop: Spacing.md, gap: Spacing.xs },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sectionLabel: { fontSize: 13, fontWeight: "500", color: Color.textPrimary },
  sectionMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  sectionSets: { fontSize: 11, color: Color.textMuted, fontVariant: ["tabular-nums"] },
  tierBadge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.xs, paddingVertical: 2 },
  tierBadgeText: { fontSize: 10, fontWeight: "700" },
  unresolvedNote: { fontSize: 11, color: Color.textFaint, lineHeight: 16, marginTop: Spacing.md },
});
