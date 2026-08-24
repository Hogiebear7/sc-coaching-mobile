import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageStyle } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoModal } from "@/components/ui/InfoModal";
import { ReadinessRing } from "@/components/ui/ReadinessRing";
import { ReadinessSparkline } from "@/components/ui/ReadinessSparkline";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Color, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/queries/dashboard";
import { useNotifications } from "@/lib/queries/notifications";
import { useProfile } from "@/lib/queries/profile";

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
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter((n) => n.readAt === null).length ?? 0;
  const { data: profile } = useProfile();
  const [infoModal, setInfoModal] = useState<"load" | "sleep" | null>(null);

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
              <Pressable
                onPress={() => router.push("/notifications")}
                hitSlop={8}
                style={styles.bellWrap}
              >
                <Ionicons name="notifications-outline" size={22} color={Color.textMuted} />
                {unreadCount > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable onPress={() => router.push("/profile")} hitSlop={8}>
                {profile?.avatarDataUrl ? (
                  <Image source={{ uri: profile.avatarDataUrl }} style={styles.avatarThumb as ImageStyle} contentFit="cover" />
                ) : (
                  <Ionicons name="person-circle-outline" size={24} color={Color.textMuted} />
                )}
              </Pressable>
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
          <SectionHeader
            label="NEXT SESSION"
            right={
              data.hasMonthPasses ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {data.monthPassesRemaining === null
                      ? "Unlimited classes"
                      : `${data.monthPassesRemaining} left this month`}
                  </Text>
                </View>
              ) : undefined
            }
          />
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
              <EmptyState
                icon="calendar-outline"
                title="No session booked yet"
                body="Book your next session to keep your training on track."
                actionLabel="Book next session"
                onAction={() => router.push("/(tabs)/schedule")}
                variant="primary"
              />
            )}
          </Card>
        </View>

        {/* Readiness — the one dominant module on Home: hero surface tier,
            a bigger ring, and (when there's no check-in yet) a real action
            instead of a dead-end line of text. */}
        <View style={styles.section}>
          <SectionHeader label="READINESS" />
          <Card style={styles.readinessCard} tier="hero">
            {readiness.today !== null ? (
              <>
                <View style={styles.readinessRow}>
                  <ReadinessRing score={readiness.today} size={88} />
                  <View style={styles.readinessTextWrap}>
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
                    {readiness.phaseNote ? (
                      <Text style={styles.readinessGuidance}>{readiness.phaseNote}</Text>
                    ) : null}
                    {readiness.pregnancyNote ? (
                      <Text style={styles.readinessGuidance}>{readiness.pregnancyNote}</Text>
                    ) : null}
                  </View>
                </View>

                {readiness.hasTrend ? (
                  <View style={styles.trendRow}>
                    <ReadinessSparkline series={readiness.trend} />
                    <Text style={styles.trendLabel}>Readiness · 14d trend</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon="heart-outline"
                title="No check-in yet"
                body="Log today's recovery to get a readiness score and session guidance."
                actionLabel="Log check-in"
                onAction={() => router.push("/(tabs)/recovery")}
                variant="primary"
              />
            )}
          </Card>

          <View style={styles.kpiRow}>
            <StatCard
              label="7-Day Load"
              value={data.kpis.sevenDaySum > 0 ? String(data.kpis.sevenDaySum) : "—"}
              subtext={data.kpis.daysWithLoad > 0 ? data.kpis.loadBandLabel : "log duration & RPE"}
              onInfoPress={() => setInfoModal("load")}
            />
            <StatCard
              label="Sleep"
              value={data.kpis.sleepHours != null ? String(data.kpis.sleepHours) : "—"}
              unit={data.kpis.sleepHours != null ? "h" : undefined}
              subtext={data.kpis.sleepQuality != null ? `quality ${data.kpis.sleepQuality}/5` : "last check-in"}
              onInfoPress={() => setInfoModal("sleep")}
            />
            <StatCard label="Sessions" value={String(data.kpis.sessionsLast7)} subtext="7 days" />
          </View>
        </View>

        <InfoModal
          visible={infoModal === "load"}
          onClose={() => setInfoModal(null)}
          title="7-Day Load"
          body="Training duration × RPE, added up over a rolling 7-day window ending today. Days you don't log a session simply add nothing — a quiet week, a rest day, or a brand-new account all show a lower number rather than a broken one. It resets naturally as old days roll out of the window, so you're always seeing your most recent week, not a running total."
        />
        <InfoModal
          visible={infoModal === "sleep"}
          onClose={() => setInfoModal(null)}
          title="Sleep"
          body="Your most recent recovery check-in's sleep hours and quality rating. Log a check-in on the Recovery tab any morning to update it — it always shows your latest entry, not an average."
        />

        {/* Nutrition */}
        <View style={styles.section}>
          <SectionHeader label="NUTRITION" />
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

        {/* Club — lower-priority utility info relative to Readiness/Next
            Session/Nutrition above, so it gets the quiet tier rather than
            competing at the same visual weight as everything else. */}
        <View style={styles.section}>
          <SectionHeader label="YOUR CLUB" />
          <Card tier="quiet">
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
            <Pressable onPress={() => router.push("/messages")} style={[styles.rowCard, styles.rowCardDivider]}>
              <View style={styles.rowCardIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCardTitle}>Coach</Text>
                <Text style={styles.rowCardSub}>Message your coach</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/workout-library", params: { tab: "exercises" } })}
              style={styles.rowCard}
            >
              <View style={styles.rowCardIcon}>
                <Ionicons name="body-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCardTitle}>Library</Text>
                <Text style={styles.rowCardSub}>Exercises, demonstrations & your saved workouts</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
          </Card>
        </View>

        {/* Quick actions — these used to be two identical cards with the
            same gold icon, same size, same weight, so nothing told you
            which one mattered more. Today's workout is the genuinely
            high-frequency action during a training day, so it gets the
            accent top-border (the one place on Home that signal is worth
            spending) and a bigger icon; View profile drops to a quiet,
            un-accented row underneath rather than competing for the same
            attention. */}
        <View style={styles.section}>
          <SectionHeader label="QUICK ACTIONS" />
          <Card accent style={styles.primaryActionCard}>
            <Pressable onPress={() => router.push("/(tabs)/workouts")} style={styles.primaryActionInner}>
              <View style={styles.primaryActionIcon}>
                <Ionicons name="flash-outline" size={22} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryActionTitle}>Today&apos;s workout</Text>
                <Text style={styles.primaryActionSub} numberOfLines={1}>
                  {data.quickActions.programmeEnabled && data.quickActions.programmeTitle
                    ? data.quickActions.programmeTitle
                    : "Log & review sessions"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
          </Card>
          <Card tier="quiet">
            <Pressable onPress={() => router.push("/profile")} style={styles.rowCard}>
              <Ionicons name="person-outline" size={18} color={Color.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCardTitle}>View profile</Text>
                <Text style={styles.rowCardSub} numberOfLines={1}>
                  {data.quickActions.primaryGoal ?? "Goals & intake"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>
          </Card>
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
  bellWrap: {
    position: "relative",
  },
  avatarThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: Color.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Color.goldForeground,
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
  primaryActionCard: {
    marginBottom: Spacing.sm,
  },
  primaryActionInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  primaryActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Color.textPrimary,
  },
  primaryActionSub: {
    fontSize: 12,
    color: Color.textMuted,
    marginTop: 2,
  },
  signedInAs: {
    fontSize: 11,
    color: Color.textFaint,
    textAlign: "center",
    marginTop: Spacing.md,
  },
});
