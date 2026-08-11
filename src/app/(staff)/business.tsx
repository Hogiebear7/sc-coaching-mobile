import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useStaffBusiness } from "@/lib/queries/staff";

function confirmLogout(logout: () => void) {
  Alert.alert("Log out?", "You'll need to sign in again to access classes and members.", [
    { text: "Cancel", style: "cancel" },
    { text: "Log out", style: "destructive", onPress: logout },
  ]);
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function deltaLabel(thisMonth: number, lastMonth: number): { text: string; positive: boolean } | null {
  if (lastMonth === 0) return null;
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  return { text: `${pct >= 0 ? "+" : ""}${pct}% vs last month`, positive: pct >= 0 };
}

export default function StaffBusinessScreen() {
  const { logout } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useStaffBusiness();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Business</Text>
        <Pressable onPress={() => confirmLogout(logout)} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color={Color.textMuted} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load business data.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          {data.revenue ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>REVENUE</Text>
              <Card style={styles.heroCard}>
                <Text style={styles.heroLabel}>This month</Text>
                <Text style={styles.heroValue}>{formatMoney(data.revenue.thisMonthCents, data.revenue.currency)}</Text>
                {(() => {
                  const delta = deltaLabel(data.revenue.thisMonthCents, data.revenue.lastMonthCents);
                  return delta ? (
                    <Text style={[styles.heroDelta, { color: delta.positive ? Color.success : Color.warning }]}>
                      {delta.text}
                    </Text>
                  ) : null;
                })()}
                <View style={styles.heroDivider} />
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Last month</Text>
                  <Text style={styles.rowValue}>{formatMoney(data.revenue.lastMonthCents, data.revenue.currency)}</Text>
                </View>
                {data.revenue.taxRatePercent !== null ? (
                  <View style={styles.rowLine}>
                    <Text style={styles.rowLabel}>Est. tax ({data.revenue.taxRatePercent}%)</Text>
                    <Text style={styles.rowValue}>
                      {formatMoney(Math.round((data.revenue.thisMonthCents * data.revenue.taxRatePercent) / 100), data.revenue.currency)}
                    </Text>
                  </View>
                ) : null}
              </Card>
            </View>
          ) : null}

          {data.membership ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MEMBERSHIP</Text>
              <View style={styles.statsRow}>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{data.membership.activeMembers}</Text>
                  <Text style={styles.statLabel}>active members</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{data.membership.newSignupsThisMonth}</Text>
                  <Text style={styles.statLabel}>new this month</Text>
                </Card>
              </View>
            </View>
          ) : null}

          {data.classes ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CLASSES · THIS MONTH</Text>
              <View style={styles.statsRow}>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{data.classes.classesThisMonth}</Text>
                  <Text style={styles.statLabel}>held</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{data.classes.bookingsThisMonth}</Text>
                  <Text style={styles.statLabel}>bookings</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {data.classes.bookingsThisMonth > 0
                      ? `${Math.round((data.classes.attendedThisMonth / data.classes.bookingsThisMonth) * 100)}%`
                      : "—"}
                  </Text>
                  <Text style={styles.statLabel}>attended</Text>
                </Card>
              </View>
            </View>
          ) : null}

          {!data.revenue && !data.membership && !data.classes ? (
            <Text style={styles.errorText}>No business data available for your role.</Text>
          ) : (
            <Card style={styles.noteCard}>
              <Text style={styles.noteText}>
                Full ledgers, custom date ranges, and demographic breakdowns are on the staff web app for now —
                coming to mobile soon.
              </Text>
            </Card>
          )}
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
  headerTitle: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center", marginTop: Spacing.md },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  heroCard: { padding: Spacing.lg },
  heroLabel: { fontSize: 11, color: Color.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  heroValue: { fontSize: 32, fontWeight: "700", color: Color.gold, marginTop: 4, fontVariant: ["tabular-nums"] },
  heroDelta: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: Color.borderSubtle, marginVertical: Spacing.md },
  rowLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel: { fontSize: 12, color: Color.textMuted },
  rowValue: { fontSize: 13, color: Color.textPrimary, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  statCard: { flex: 1, padding: Spacing.md, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10, color: Color.textMuted, marginTop: 4, textAlign: "center" },
  noteCard: { padding: Spacing.md },
  noteText: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
});
