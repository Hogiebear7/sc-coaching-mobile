import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { API_BASE_URL } from "@/constants/config";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useMembership } from "@/lib/queries/membership";

// Deliberately opens the system browser rather than an in-app WebView, and
// deliberately shows no prices or "Buy" button here — gym membership is a
// real-world service, exempt from Apple/Google's in-app-purchase
// requirement, but only as long as the app itself never presents a
// purchase flow. Handing off to the browser for the actual checkout keeps
// this clearly on the right side of that line.
function openMembershipOnWeb() {
  tapFeedback();
  Linking.openURL(`${API_BASE_URL}/dashboard/membership`);
}

const STATUS_LABEL: Record<string, string> = {
  inactive: "Pending billing setup",
  pending: "Awaiting payment",
  active: "Active",
  canceled: "Canceled",
  past_due: "Past due",
  paused: "Paused",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function MembershipScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMembership();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Membership</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load membership data.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card
            style={[
              styles.statusCard,
              data.isPeriodLapsed && styles.statusCardAttention,
            ]}
          >
            <Text style={styles.planLabel}>CURRENT PLAN</Text>
            <Text style={styles.planName}>{data.currentPlanName ?? "No active plan"}</Text>
            {data.subscriptionStatus ? (
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>
                  {data.isPeriodLapsed ? "Period ended" : STATUS_LABEL[data.subscriptionStatus] ?? data.subscriptionStatus}
                </Text>
              </View>
            ) : (
              <Pressable style={styles.statusChip} onPress={openMembershipOnWeb}>
                <Text style={styles.statusChipText}>Get started</Text>
              </Pressable>
            )}
            {data.subscriptionPausedUntil ? (
              <Text style={styles.planMeta}>Paused until {formatDate(data.subscriptionPausedUntil)}</Text>
            ) : data.subscriptionCurrentPeriodEnd ? (
              <Text style={styles.planMeta}>Renews {formatDate(data.subscriptionCurrentPeriodEnd)}</Text>
            ) : null}
          </Card>

          <View style={styles.statsRow}>
            {data.hasActivePassAllowance ? (
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>
                  {data.passBalanceRemaining === null ? "∞" : data.passBalanceRemaining}
                </Text>
                <Text style={styles.statLabel}>sessions left</Text>
              </Card>
            ) : null}
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{data.purchasedPasses}</Text>
              <Text style={styles.statLabel}>pass packs</Text>
            </Card>
          </View>

          {data.expiringPassesCount > 0 ? (
            <Card style={styles.warningCard}>
              <Ionicons name="alert-circle-outline" size={18} color={Color.warning} />
              <Text style={styles.warningText}>
                {data.expiringPassesCount} pass{data.expiringPassesCount === 1 ? "" : "es"} expiring by{" "}
                {formatDate(data.expiringPassesSoonestAt)}
              </Text>
            </Card>
          ) : null}

          <Button
            title={data.currentPlanName ? "Manage membership on web" : "View plans on web"}
            onPress={openMembershipOnWeb}
            variant="secondary"
            style={{ marginTop: Spacing.sm }}
          />
          <Text style={styles.noteText}>
            Plan changes, pass packs, and billing open in your browser — full checkout is coming to the app
            itself soon.
          </Text>
        </ScrollView>
      )}
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
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  statusCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  statusCardAttention: { borderColor: Color.danger },
  planLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  planName: { fontSize: 20, fontWeight: "700", color: Color.textPrimary, marginTop: 4 },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginTop: Spacing.sm,
  },
  statusChipText: { fontSize: 11, fontWeight: "600", color: Color.gold },
  planMeta: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.sm },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, padding: Spacing.md, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, color: Color.textMuted, marginTop: 4 },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderColor: Color.warning,
    backgroundColor: Color.warningWeak,
  },
  warningText: { fontSize: 12, color: Color.warning, flex: 1 },
  noteText: { fontSize: 12, color: Color.textMuted, lineHeight: 17, marginTop: Spacing.sm, textAlign: "center" },
});
