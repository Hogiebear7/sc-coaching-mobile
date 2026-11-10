import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spacing } from "@/constants/theme";
import { useApplyProgrammeAdjustment, useProgrammeCheckIn } from "@/lib/queries/programs";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

const PROPOSAL_LABEL: Record<string, string> = {
  accelerate: "Speed up your progression",
  hold_back: "Ease off the pace",
  expedite_timeline: "Shorten your programme",
};

// End-of-cycle AI check-in — read-only feedback plus, only when the AI
// proposed one (see PROGRAMME_CHECKIN_SYSTEM_PROMPT in the main repo's
// lib/ai.ts), an Accept/Decline card for a pace or timeline adjustment.
// Nothing is ever applied without an explicit tap here.
export default function ProgrammeCheckInScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { programId, cycleIndex: cycleIndexParam } = useLocalSearchParams<{ programId?: string; cycleIndex?: string }>();
  const cycleIndex = cycleIndexParam !== undefined ? Number(cycleIndexParam) : undefined;

  const { data, isLoading, isError, refetch } = useProgrammeCheckIn(programId, cycleIndex);
  const applyAdjustment = useApplyProgrammeAdjustment(programId);

  function handleDecision(decision: "accept" | "decline", kind: "adjustment" | "refresh" = "adjustment") {
    if (cycleIndex === undefined) return;
    applyAdjustment.mutate({ cycleIndex, kind, decision }, { onSuccess: () => refetch() });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Weekly check-in</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={Color.gold} />
          <Text style={styles.loadingText}>Putting your check-in together…</Text>
        </View>
      ) : isError || !data ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>Couldn&apos;t load your check-in right now.</Text>
          <Button title="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.lg }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.weekLabel}>WEEK {data.cycleIndex + 1}</Text>
          <Card style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>{data.feedbackText}</Text>
          </Card>

          {data.adjustmentProposal ? (
            <Card style={styles.proposalCard}>
              <Text style={styles.proposalLabel}>{PROPOSAL_LABEL[data.adjustmentProposal.type] ?? "Suggested change"}</Text>
              <Text style={styles.proposalRationale}>{data.adjustmentProposal.rationale}</Text>
              {data.adjustmentProposal.type === "expedite_timeline" && data.adjustmentProposal.proposedTotalWeeks ? (
                <Text style={styles.proposalDetail}>New length: {data.adjustmentProposal.proposedTotalWeeks} weeks</Text>
              ) : null}

              {data.adjustmentDecision === null ? (
                <View style={styles.decisionRow}>
                  <Button
                    title="Accept"
                    onPress={() => handleDecision("accept")}
                    loading={applyAdjustment.isPending}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Decline"
                    variant="secondary"
                    onPress={() => handleDecision("decline")}
                    disabled={applyAdjustment.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <Text style={styles.decisionText}>
                  {data.adjustmentDecision === "accepted" ? "Accepted — your programme has been updated." : "Declined — your programme is unchanged."}
                </Text>
              )}
            </Card>
          ) : null}

          {data.exerciseRefreshProposal ? (
            <Card style={styles.refreshCard}>
              <Text style={styles.refreshLabel}>Refresh your exercises</Text>
              <Text style={styles.proposalRationale}>{data.exerciseRefreshProposal.rationale}</Text>
              <Text style={styles.proposalDetail}>
                Swaps each workout day&apos;s exercises for different ones targeting the same muscle groups — your
                weight/rep targets start fresh from your logged history, same as day one.
              </Text>

              {data.exerciseRefreshDecision === null ? (
                <View style={styles.decisionRow}>
                  <Button
                    title="Accept"
                    onPress={() => handleDecision("accept", "refresh")}
                    loading={applyAdjustment.isPending}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Decline"
                    variant="secondary"
                    onPress={() => handleDecision("decline", "refresh")}
                    disabled={applyAdjustment.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <Text style={styles.decisionText}>
                  {data.exerciseRefreshDecision === "accepted"
                    ? "Accepted — your exercises have been refreshed."
                    : "Declined — your exercises are unchanged."}
                </Text>
              )}
            </Card>
          ) : null}

          <Button title="Done" onPress={() => router.replace("/(tabs)/workouts")} style={{ marginTop: Spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    loadingText: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.md },
    errorText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
    weekLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
    // The v2 Card has no padding of its own, so each tinted card here sets it (text used to run to the edge and be clipped by the rounded corners).
    feedbackCard: { borderColor: Color.goldBorder, backgroundColor: Color.goldWeak, padding: Spacing.lg },
    feedbackText: { fontSize: 14, color: Color.textPrimary, lineHeight: 20 },
    proposalCard: { marginTop: Spacing.lg, borderColor: "rgba(85,196,254,0.35)", backgroundColor: "rgba(85,196,254,0.1)", padding: Spacing.lg },
    proposalLabel: { fontSize: 14, fontWeight: "700", color: Color.accentData },
    proposalRationale: { fontSize: 13, color: Color.textSecondary, lineHeight: 19, marginTop: Spacing.xs },
    proposalDetail: { fontSize: 14, color: Color.textMuted, marginTop: Spacing.sm },
    refreshCard: { marginTop: Spacing.lg, borderColor: "rgba(143,191,159,0.35)", backgroundColor: "rgba(143,191,159,0.1)", padding: Spacing.lg },
    refreshLabel: { fontSize: 14, fontWeight: "700", color: Color.success },
    decisionRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
    decisionText: { fontSize: 14, color: Color.textMuted, marginTop: Spacing.md, fontStyle: "italic" },
  })
);
