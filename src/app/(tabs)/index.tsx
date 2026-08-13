import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReadinessRing } from "@/components/ui/ReadinessRing";
import { ReadinessSparkline } from "@/components/ui/ReadinessSparkline";
import { StatCard } from "@/components/ui/StatCard";
import { Color, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/queries/dashboard";

function formatTodayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatClassDate(dateISO: string): string {
  const d = new Date(dateISO);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useDashboard();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your dashboard.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const readiness = data.readiness;
  const ringColor =
    readiness.today === null
      ? Color.textMuted
      : readiness.today >= 60
      ? Color.success
      : readiness.today >= 40
      ? Color.accentData
      : Color.warning;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Color.gold} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <BrandMark height={22} style={styles.headerLogo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{formatTodayLabel().toUpperCase()}</Text>
              <Text style={styles.greeting}>Hi {data.firstName}</Text>
            </View>
            <View style={styles.headerActions}>
              <Ionicons
                name="person-circle-outline"
                size={24}
                color={Color.textMuted}
                onPress={() => router.push("/profile")}
                suppressHighlighting
              />
              <Ionicons
                name="log-out-outline"
                size={22}
                color={Color.textMuted}
                onPress={logout}
                suppressHighlighting
              />
            </View>
          </View>
          <Text style={styles.subGreeting}>Ready when you are.</Text>
        </View>

        {/* Next Session */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>NEXT SESSION</Text>
            {data.hasMonthPasses && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {data.monthPassesRemaining === null
                    ? "Unlimited classes"
                    : `${data.monthPassesRemaining} left this month`}
                </Text>
              </View>
            )}
          </View>
          <Card style={styles.nextSessionCard}>
            {data.nextSession ? (
              <View style={styles.nextSessionRow}>
                <View style={styles.nextSessionTime}>
                  <Text style={styles.nextSessionTimeText}>
                    {data.nextSession.startTime.split(":")[0]}
                  </Text>
                  <Text style={styles.nextSessionTimeSub}>:{data.nextSession.startTime.split(":")[1]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextSessionTitle}>{data.nextSession.title}</Text>
                  <Text style={styles.nextSessionMeta}>
                    {formatClassDate(data.nextSession.date)} · {data.nextSession.durationMins} min
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nothing booked</Text>
                <Text style={styles.emptyBody}>Reserve your next session in a couple of taps.</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Readiness */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>READINESS</Text>
          <Card style={styles.readinessCard}>
            <View style={styles.readinessRow}>
              <ReadinessRing score={readiness.today} />
              <View style={styles.readinessTextWrap}>
                {readiness.today !== null ? (
                  <>
                    <View style={styles.readinessStatusRow}>
                      <Text style={styles.readinessStatus}>{readiness.status}</Text>
                      {readiness.delta !== null && readiness.delta !== 0 && (
                        <View
                          style={[
                            styles.deltaChip,
                            { borderColor: readiness.delta > 0 ? Color.success : Color.warning },
                          ]}
                        >
                          <Ionicons
                            name={readiness.delta > 0 ? "arrow-up" : "arrow-down"}
                            size={9}
                            color={readiness.delta > 0 ? Color.success : Color.warning}
                          />
                          <Text
                            style={[
                              styles.deltaText,
                              { color: readiness.delta > 0 ? Color.success : Color.warning },
                            ]}
                          >
                            {Math.abs(readiness.delta)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.readinessGuidance}>{readiness.guidance}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.readinessStatus}>No check-in yet</Text>
                    <Text style={styles.readinessGuidance}>
                      Log today&apos;s recovery to get a readiness score and session guidance.
                    </Text>
                  </>
                )}
                {readiness.phaseNote ? (
                  <Text style={styles.readinessGuidance}>{readiness.phaseNote}</Text>
                ) : null}
              </View>
            </View>

            {readiness.hasTrend ? (
              <View style={styles.trendRow}>
                <ReadinessSparkline series={readiness.trend} />
                <Text style={styles.trendLabel}>Readiness · 14d trend</Text>
              </View>
            ) : null}
          </Card>

          <View style={styles.kpiRow}>
            <StatCard
              label="7-Day Load"
              value={data.kpis.sevenDaySum > 0 ? String(data.kpis.sevenDaySum) : "—"}
              subtext={data.kpis.daysWithLoad > 0 ? data.kpis.loadBandLabel : "log duration & RPE"}
            />
            <StatCard
              label="Sleep"
              value={data.kpis.sleepHours != null ? String(data.kpis.sleepHours) : "—"}
              unit={data.kpis.sleepHours != null ? "h" : undefined}
              subtext={data.kpis.sleepQuality != null ? `quality ${data.kpis.sleepQuality}/5` : "last check-in"}
            />
            <StatCard label="Sessions" value={String(data.kpis.sessionsLast7)} subtext="7 days" />
          </View>
        </View>

        {/* Nutrition */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NUTRITION</Text>
          <Card>
            <Pressable onPress={() => router.push("/(tabs)/nutrition")} style={styles.rowCard}>
              <View style={styles.rowCardIcon}>
                <Ionicons name="nutrition-outline" size={20} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCardTitle}>Fuel today&apos;s training</Text>
                <Text style={styles.rowCardSub}>
                  {data.nutrition.dietaryPreference
                    ? `${data.nutrition.dietaryPreference[0].toUpperCase()}${data.nutrition.dietaryPreference.slice(1)} · log meals & hydration`
                    : "Log meals & hydration"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
          </Card>
        </View>

        {/* Club */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR CLUB</Text>
          <Card>
            <Pressable onPress={() => router.push("/membership")} style={[styles.rowCard, styles.rowCardDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCardLabel}>MEMBERSHIP</Text>
                <Text style={styles.rowCardTitle}>{data.club.planName ?? "No active plan"}</Text>
                {data.club.remainingSessionsLabel ? (
                  <Text style={styles.rowCardSub}>{data.club.remainingSessionsLabel}</Text>
                ) : !data.club.hasSubscription ? (
                  <Text style={styles.rowCardSub}>Choose a plan to start booking sessions</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusChip,
                  data.club.needsAttention && { borderColor: Color.danger, backgroundColor: Color.dangerWeak },
                ]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    data.club.needsAttention && { color: Color.danger },
                  ]}
                >
                  {!data.club.hasSubscription ? "Get started" : data.club.statusLabel}
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={() => router.push("/messages")} style={styles.rowCard}>
              <View style={styles.rowCardIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCardTitle}>Coach</Text>
                <Text style={styles.rowCardSub}>Message your coach</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
          </Card>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.quickActionsRow}>
            <Card style={{ flex: 1 }}>
              <Pressable onPress={() => router.push("/(tabs)/workouts")} style={styles.quickActionCard}>
                <Ionicons name="flash-outline" size={18} color={Color.gold} />
                <Text style={styles.quickActionTitle}>Today&apos;s workout</Text>
                <Text style={styles.quickActionSub} numberOfLines={1}>
                  {data.quickActions.programmeEnabled && data.quickActions.programmeTitle
                    ? data.quickActions.programmeTitle
                    : "Log & review sessions"}
                </Text>
              </Pressable>
            </Card>
            <Card style={{ flex: 1 }}>
              <Pressable onPress={() => router.push("/profile")} style={styles.quickActionCard}>
                <Ionicons name="person-outline" size={18} color={Color.gold} />
                <Text style={styles.quickActionTitle}>View profile</Text>
                <Text style={styles.quickActionSub} numberOfLines={1}>
                  {data.quickActions.primaryGoal ?? "Goals & intake"}
                </Text>
              </Pressable>
            </Card>
          </View>
        </View>

        <Text style={styles.signedInAs}>Signed in as {user?.email}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    marginRight: Spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: Color.gold,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    fontStyle: "italic",
    color: Color.textPrimary,
  },
  subGreeting: {
    fontSize: 13,
    color: Color.textMuted,
    marginTop: 4,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
    marginBottom: Spacing.sm,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "600",
    color: Color.textSecondary,
  },
  nextSessionCard: {
    padding: 0,
  },
  nextSessionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  nextSessionTime: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  nextSessionTimeText: {
    fontSize: 18,
    fontWeight: "700",
    color: Color.gold,
  },
  nextSessionTimeSub: {
    fontSize: 11,
    color: Color.gold,
    opacity: 0.8,
  },
  nextSessionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Color.textPrimary,
  },
  nextSessionMeta: {
    fontSize: 12,
    color: Color.textMuted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Color.textPrimary,
  },
  emptyBody: {
    fontSize: 12,
    color: Color.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  readinessCard: {
    padding: Spacing.md,
  },
  readinessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  readinessTextWrap: {
    flex: 1,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  trendLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: Color.textFaint,
  },
  readinessStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  readinessStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: Color.textPrimary,
  },
  deltaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  deltaText: {
    fontSize: 10,
    fontWeight: "700",
  },
  readinessGuidance: {
    fontSize: 12,
    color: Color.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  kpiRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  rowCardDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  rowCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: Color.textMuted,
    marginBottom: 2,
  },
  rowCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Color.textPrimary,
  },
  rowCardSub: {
    fontSize: 11,
    color: Color.textMuted,
    marginTop: 2,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: Color.gold,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Color.textPrimary,
  },
  quickActionSub: {
    fontSize: 11,
    color: Color.textMuted,
  },
  signedInAs: {
    fontSize: 11,
    color: Color.textFaint,
    textAlign: "center",
    marginTop: Spacing.md,
  },
});
