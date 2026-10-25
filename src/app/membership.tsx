import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { API_BASE_URL } from "@/constants/config";
import { figure, Radius, Spacing } from "@/constants/theme";
import { apiFetch } from "@/lib/api-client";
import { tapFeedback } from "@/lib/haptics";
import { useMembership } from "@/lib/queries/membership";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

const MEMBERSHIP_PATH = "/dashboard/membership";

// Deliberately opens the system browser rather than an in-app WebView, and
// deliberately shows no prices or "Buy" button here — gym membership is a
// real-world service, exempt from Apple/Google's in-app-purchase
// requirement, but only as long as the app itself never presents a
// purchase flow. Handing off to the browser for the actual checkout keeps
// this clearly on the right side of that line.
//
// Mints a short-lived, single-use handoff token first so that browser lands
// already signed in as the same member, instead of dropping them at a login
// screen (see gym-app's app/api/mobile/auth/web-handoff and app/api/auth/
// web-handoff routes). If minting fails for any reason (offline, expired
// mobile session, server hiccup), falls back to opening the bare URL —
// exactly today's behavior — rather than blocking the button.
async function openMembershipOnWeb() {
  tapFeedback();
  try {
    const res = await apiFetch<{ success: true; data: { token: string } }>("/api/mobile/auth/web-handoff", {
      method: "POST",
    });
    const params = new URLSearchParams({ token: res.data.token, next: MEMBERSHIP_PATH });
    Linking.openURL(`${API_BASE_URL}/api/auth/web-handoff?${params.toString()}`);
  } catch {
    Linking.openURL(`${API_BASE_URL}${MEMBERSHIP_PATH}`);
  }
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
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMembership();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Membership</Text>
        <View style={{ width: 36 }} />
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
            <Text style={styles.planLabel}>Current plan</Text>
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
            {/* Mirrors the web Membership page: "renews" only for an active,
                unexpired period. Automatic renewal doesn't exist yet, so a
                past end date means the member has to renew themselves. */}
            {data.subscriptionPausedUntil ? (
              <Text style={styles.planMeta}>Paused until {formatDate(data.subscriptionPausedUntil)}</Text>
            ) : data.isPeriodLapsed ? (
              <View style={styles.notice}>
                <Ionicons name="alert-circle" size={18} color={Color.danger} />
                <Text style={styles.noticeText}>
                  Your billing period ended on {formatDate(data.subscriptionCurrentPeriodEnd)}. Renew on the web to keep
                  booking sessions.
                </Text>
              </View>
            ) : data.subscriptionStatus === "past_due" ? (
              <View style={styles.notice}>
                <Ionicons name="alert-circle" size={18} color={Color.danger} />
                <Text style={styles.noticeText}>Your last payment failed. Update your payment method to keep your sessions.</Text>
              </View>
            ) : data.subscriptionStatus === "active" && data.subscriptionCurrentPeriodEnd ? (
              <Text style={styles.planMeta}>
                Billing period ends {formatDate(data.subscriptionCurrentPeriodEnd)} · renews automatically
              </Text>
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
            title={data.isPeriodLapsed ? "Renew on web" : data.currentPlanName ? "Manage membership on web" : "View plans on web"}
            onPress={openMembershipOnWeb}
            variant={data.isPeriodLapsed || !data.currentPlanName ? "primary" : "secondary"}
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
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    errorText: { color: Color.textMuted, fontSize: 14 },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    statusCard: { padding: Spacing.lg, marginBottom: Spacing.md },
    statusCardAttention: { borderWidth: 1.5, borderColor: Color.danger },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: Color.dangerWeak,
    },
    noticeText: { flex: 1, fontSize: 15, lineHeight: 21, color: Color.textPrimary },
    planLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
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
    statusChipText: { fontSize: 13, fontWeight: "600", color: Color.gold },
    planMeta: { fontSize: 14, color: Color.textMuted, marginTop: Spacing.sm },
    statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
    statCard: { flex: 1, padding: Spacing.md, alignItems: "center" },
    statValue: { ...figure(30), color: Color.gold },
    statLabel: { fontSize: 13, color: Color.textMuted, marginTop: 4 },
    warningCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderColor: Color.warning,
      backgroundColor: Color.warningWeak,
    },
    warningText: { fontSize: 14, color: Color.warning, flex: 1 },
    noteText: { fontSize: 14, color: Color.textMuted, lineHeight: 17, marginTop: Spacing.sm, textAlign: "center" },
  })
);
