import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, InteractionManager, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile, PillButton, RoundIconButton, SectionTitle, TileGrid, WeekStrip } from "@/components/app/primitives";
import { ContinueWorkoutPill } from "@/components/ui/ContinueWorkoutPill";
import { AppRadius, AppSpace, appTitle, figure, Radius, readinessColor, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { POST_SIGNUP_SETUP_KEY_PREFIX } from "@/lib/post-signup-setup";
import { useBodyWeightLogs } from "@/lib/queries/body-weight";
import { useCommunityHighlight } from "@/lib/queries/community";
import { useDashboard } from "@/lib/queries/dashboard";
import { CAN_PROMOTE_PURCHASE } from "@/lib/upsell-config";
import { useNotifications } from "@/lib/queries/notifications";
import { useProfile } from "@/lib/queries/profile";
import { useTour } from "@/lib/tour-context";
import { makeStyles, useAppTheme, useLegacyColors } from "@/lib/theme";

// Shown once, right after a member's very first signup — offers the two
// setup steps that meaningfully improve day-one use of Workouts (an
// equipment-aware gym profile, an AI-generated first programme) without
// forcing either during the signup form itself. Gated behind the tour
// prompt/card so the two one-time modals never stack on a fresh account.
// A brand-new member lands here straight after signup with a pending
// flag set (see lib/post-signup-setup.ts). Rather than a modal, they're
// taken once to the step-by-step "Set up your plan" onboarding. Gated
// behind the tour prompt/card so the two first-run flows never stack, and
// it's a single navigation (no modal to close first).
function PostSignupOnboardingRedirect() {
  const router = useRouter();
  const { user } = useAuth();
  const { showPrompt: tourShowPrompt, activePage: tourActivePage } = useTour();
  const handled = useRef(false);

  // Waits until no tour UI is showing, then checks the flag once and, if
  // set, clears it and navigates.
  useEffect(() => {
    if (!user || handled.current || tourShowPrompt || tourActivePage) return;
    let cancelled = false;
    let handle: { cancel: () => void } | null = null;
    AsyncStorage.getItem(POST_SIGNUP_SETUP_KEY_PREFIX + user.id)
      .then((v) => {
        if (cancelled || !v || handled.current) return;
        handled.current = true;
        AsyncStorage.removeItem(POST_SIGNUP_SETUP_KEY_PREFIX + user.id).catch(() => {});
        handle = InteractionManager.runAfterInteractions(() => router.push("/onboarding" as never));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      handle?.cancel();
    };
  }, [user, tourShowPrompt, tourActivePage, router]);

  return null;
}

function formatTodayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Device's own local time, same as every other local-clock read in this
// app (see workout-draft.tsx's startedAtHour) — no timezone math needed.
// 05:00–11:59 Morning, 12:00–16:59 Afternoon, 17:00–22:59 Evening,
// 23:00–04:59 falls back to the plain greeting.
function greetingPrefix(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 23) return "Evening";
  return "Hi";
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

// Last 7 days of the 14-day readiness trend, labelled from todayISO.
function lastSevenDays(todayISO: string, trend: (number | null)[]) {
  const [y, m, d] = todayISO.split("-").map(Number);
  const today = new Date(y, (m ?? 1) - 1, d ?? 1);
  const recent = trend.slice(-7);
  while (recent.length < 7) recent.unshift(null);
  return recent.map((score, i) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - i));
    return {
      letter: day.toLocaleDateString(undefined, { weekday: "narrow" }),
      date: day.getDate(),
      score,
      isToday: i === 6,
    };
  });
}

// Home (App v2 prototype, docs/design-inspiration-macrofactor-2026-10.md):
// a screen title with round inbox buttons, a lighter top band holding the
// week's readiness strip and today's single next action, then uniform metric
// tiles grouped by topic, then the club as list rows. Colour lives on data
// only; the one primary action is white.
export default function DashboardScreen() {
  const { colors, data: dc } = useAppTheme();
  const styles = useStyles();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useDashboard();
  const { data: communityHighlight } = useCommunityHighlight();
  const { data: notifications } = useNotifications();
  const { data: weights } = useBodyWeightLogs();
  const unreadCount = notifications?.filter((n) => n.readAt === null).length ?? 0;
  const { data: profile } = useProfile();
  const memberTier = profile?.memberTier ?? "free";

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your dashboard.</Text>
          <PillButton title="Try again" onPress={() => refetch()} variant="secondary" style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const readiness = data.readiness;
  const week = lastSevenDays(data.todayISO, readiness.trend);
  const recentWeights = [...(weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const latestWeight = recentWeights[recentWeights.length - 1]?.weightKg ?? null;

  const todayAction =
    readiness.today === null
      ? { label: "Log today's check-in", href: "/(tabs)/recovery" }
      : { label: "Plan today's session", href: "/(tabs)/workouts" };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        {/* Top band: title, inbox buttons, the week, today's one action */}
        <View style={styles.band}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLine}>{formatTodayLabel()}</Text>
              <Text style={appTitle(38, colors.text)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {greetingPrefix()} {data.firstName}
              </Text>
            </View>
            <View style={styles.titleActions}>
              <RoundIconButton
                icon="notifications-outline"
                label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                badge={unreadCount > 0 ? (unreadCount > 9 ? "9+" : String(unreadCount)) : null}
                onPress={() => router.push("/notifications")}
              />
              <RoundIconButton icon="chatbubble-ellipses-outline" label="Messages" onPress={() => router.push("/messages")} />
            </View>
          </View>
          <View style={styles.continueRow}>
            <ContinueWorkoutPill />
          </View>

          <WeekStrip days={week} />

          <View style={styles.todayRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayLabel}>Readiness today</Text>
              <Text style={styles.todayStatus}>
                {readiness.today !== null ? (
                  <>
                    <Text style={{ color: readinessColor(readiness.today, dc, colors.textMuted) }}>{readiness.today}</Text>
                    {"  "}
                    {readiness.status}
                  </>
                ) : (
                  "No check-in yet"
                )}
              </Text>
              <Text style={styles.todayGuidance} numberOfLines={3}>
                {readiness.today !== null
                  ? readiness.guidance
                  : "Sleep, soreness and fatigue give you a score and today's guidance."}
              </Text>
            </View>
          </View>
          <PillButton title={todayAction.label} onPress={() => router.push(todayAction.href as never)} />
        </View>

        {/* Up next — tier-aware, same job logic as before */}
        <View style={styles.section}>
          <SectionTitle
            title="Up next"
            action={memberTier === "membership" ? "Schedule" : undefined}
            onAction={() => router.push("/(tabs)/schedule")}
          />
          {memberTier === "membership" ? (
            data.nextSession ? (
              <Pressable onPress={() => router.push("/(tabs)/schedule")} style={styles.nextCard} accessibilityRole="button">
                <View style={styles.nextTime}>
                  <Text style={styles.nextDay}>{formatClassDate(data.nextSession.date)}</Text>
                  <Text style={styles.nextClock}>{data.nextSession.startTime}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextTitle} numberOfLines={1}>{data.nextSession.title}</Text>
                  <Text style={styles.nextMeta}>
                    {data.nextSession.durationMins} min
                    {data.hasMonthPasses
                      ? ` · ${data.monthPassesRemaining === null ? "Unlimited" : `${data.monthPassesRemaining} left`} this month`
                      : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <View style={styles.nextCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextTitle}>Nothing booked</Text>
                  <Text style={styles.nextMeta}>Book your next class in a couple of taps.</Text>
                </View>
                <PillButton title="Book" variant="secondary" onPress={() => router.push("/(tabs)/schedule")} />
              </View>
            )
          ) : memberTier === "app_subscription" ? (
            <Pressable onPress={() => router.push("/(tabs)/workouts")} style={styles.nextCard} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={styles.nextTitle}>Today&apos;s workout</Text>
                <Text style={styles.nextMeta} numberOfLines={1}>
                  {data.quickActions.programmeEnabled && data.quickActions.programmeTitle
                    ? data.quickActions.programmeTitle
                    : "Log and review sessions"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={styles.nextCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextTitle}>Find a coach near you</Text>
                <Text style={styles.nextMeta}>
                  {CAN_PROMOTE_PURCHASE ? "Or unlock digital coaching from S&C." : "Search nearby gyms and coaches."}
                </Text>
              </View>
              <PillButton title="Find" variant="secondary" onPress={() => router.push("/find-a-coach" as never)} />
            </View>
          )}
        </View>

        {/* Recovery tiles */}
        <View style={styles.section}>
          <SectionTitle title="Recovery" action="See all" onAction={() => router.push("/(tabs)/recovery")} />
          <TileGrid>
            <MetricTile
              title="Readiness"
              window="Last 7 days"
              value={readiness.today !== null ? String(readiness.today) : null}
              unit="/100"
              color={readinessColor(readiness.today, dc, colors.textMuted)}
              bars={week.map((w) => w.score)}
              note="Log a check-in to start your trend"
              onPress={() => router.push("/readiness" as never)}
            />
            <MetricTile
              title="Sleep"
              window="Last check-in"
              value={data.kpis.sleepHours !== null ? String(data.kpis.sleepHours) : null}
              unit="h"
              color={dc.sleep}
              note={data.kpis.sleepQuality !== null ? `Quality ${data.kpis.sleepQuality}/10` : "Logged with your check-in"}
              onPress={() => router.push("/sleep-trend" as never)}
            />
            <MetricTile
              title="Training load"
              window="Last 7 days"
              value={data.kpis.sevenDaySum > 0 ? data.kpis.sevenDaySum.toLocaleString() : null}
              color={dc.load}
              note={data.kpis.daysWithLoad > 0 ? data.kpis.loadBandLabel : "Log time and effort"}
              onPress={() => router.push("/(tabs)/recovery")}
            />
            <MetricTile
              title="Sessions"
              window="Last 7 days"
              value={String(data.kpis.sessionsLast7)}
              unit={data.kpis.sessionsLast7 === 1 ? "workout" : "workouts"}
              color={dc.sessions}
              note="Log a workout from +"
              onPress={() => router.push("/(tabs)/workouts")}
            />
          </TileGrid>
        </View>

        {/* Body and fuel tiles */}
        <View style={styles.section}>
          <SectionTitle title="Body & fuel" />
          <TileGrid>
            <MetricTile
              title="Weight"
              window={recentWeights.length > 1 ? `Last ${recentWeights.length} entries` : "Latest"}
              value={latestWeight !== null ? latestWeight.toFixed(1) : null}
              unit="kg"
              color={dc.weight}
              bars={recentWeights.length > 1 ? recentWeights.map((w) => w.weightKg) : undefined}
              scale="range"
              note="Add a weigh-in"
              onPress={() => router.push("/weight-trend" as never)}
            />
            <MetricTile
              title="Nutrition"
              window="Today"
              value={null}
              color={dc.protein}
              note={
                data.nutrition.dietaryPreference && data.nutrition.dietaryPreference !== "standard"
                  ? `${data.nutrition.dietaryPreference} · log meals and water`
                  : "Log meals and water"
              }
              onPress={() => router.push("/(tabs)/nutrition")}
            />
          </TileGrid>
        </View>

        {/* Club */}
        <View style={styles.section}>
          <SectionTitle title="Club" />
          <View style={styles.list}>
            <ListRow
              icon="card-outline"
              title={data.club.planName ?? "No active plan"}
              detail={data.club.remainingSessionsLabel ?? data.club.statusLabel ?? (CAN_PROMOTE_PURCHASE ? "Choose a plan" : "No plan on this account yet")}
              attention={data.club.needsAttention}
              onPress={() => router.push("/membership")}
            />
            <ListRow icon="chatbubble-ellipses-outline" title="Coach" detail="Message your coach" onPress={() => router.push("/messages")} divider />
            <ListRow
              icon="people-outline"
              title="Community"
              detail={communityHighlight?.text ?? "Member wins and leaderboards"}
              onPress={() => router.push("/community")}
              divider
            />
          </View>
        </View>
      </ScrollView>
      <PostSignupOnboardingRedirect />
    </SafeAreaView>
  );
}

function ListRow({
  icon,
  title,
  detail,
  onPress,
  divider,
  attention,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
  divider?: boolean;
  attention?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const Color = useLegacyColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={22} color={attention ? Color.warning : colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowDetail, attention && { color: Color.warning }]} numberOfLines={1}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors, dc, Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    errorText: { fontSize: 16, color: colors.textSecondary },
    scroll: { paddingBottom: 40 },

    band: { backgroundColor: colors.surface, paddingHorizontal: AppSpace.gutter, paddingTop: 12, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 16 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    dateLine: { fontSize: 14, color: colors.textMuted, marginBottom: 2 },
    titleActions: { flexDirection: "row", gap: 8 },
    continueRow: { alignItems: "flex-end", marginTop: -8 },
    todayRow: { flexDirection: "row" },
    todayLabel: { fontSize: 14, color: colors.textMuted },
    todayStatus: { marginTop: 2, fontSize: 22, fontWeight: "600", color: colors.text },
    todayGuidance: { marginTop: 4, fontSize: 15, lineHeight: 21, color: colors.textSecondary },

    section: { paddingHorizontal: AppSpace.gutter, marginTop: AppSpace.section },

    nextCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: AppRadius.card, padding: 16, minHeight: 76 },
    nextTime: { width: 72, borderRadius: AppRadius.inner, backgroundColor: colors.control, paddingVertical: 8, alignItems: "center" },
    nextDay: { fontSize: 12, color: colors.textSecondary },
    nextClock: { ...figure(26), color: colors.text },
    nextTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
    nextMeta: { marginTop: 2, fontSize: 14, color: colors.textMuted },

    list: { backgroundColor: colors.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 64, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
    rowTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
    rowDetail: { marginTop: 2, fontSize: 14, color: colors.textMuted },

    // First-signup setup modal (unchanged from the previous Home)
    setupBackdrop: {
      flex: 1,
      backgroundColor: "rgba(4,10,20,0.72)",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.xl,
    },
    setupCard: {
      width: "100%",
      maxWidth: 380,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Color.borderDefault,
      backgroundColor: Color.surface1,
      padding: Spacing.xl,
      alignItems: "center",
    },
    setupIcon: {
      width: 44,
      height: 44,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: Color.goldBorder,
      backgroundColor: Color.goldWeak,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    setupTitle: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, textAlign: "center" },
    setupBody: {
      fontSize: 13,
      color: Color.textMuted,
      textAlign: "center",
      marginTop: Spacing.sm,
      lineHeight: 19,
    },
    setupButton: { width: "100%", marginTop: Spacing.lg },
    setupLaterButton: { marginTop: Spacing.md, padding: Spacing.xs },
    setupLaterText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  })
);
