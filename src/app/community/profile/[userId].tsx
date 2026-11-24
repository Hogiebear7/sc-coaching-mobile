import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AppSpace, appTitle } from "@/constants/theme";
import { formatCommunityDate } from "@/lib/community-formatters";
import { formatMemberSince, formatVolumeKg, sessionsLabel } from "@/lib/community-profile-format";
import { tapFeedback } from "@/lib/haptics";
import { useCommunityProfile, useFollowUser, useUnfollowUser, type CommunityProfileStats } from "@/lib/queries/community";
import { makeStyles, useAppTheme } from "@/lib/theme";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const WINDOWS: { key: keyof CommunityProfileStats; label: string }[] = [
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "year", label: "Last 12 months" },
];

// The card behind a tapped name in Community: name, a follow button and, when the person's own privacy setting allows you, their volume and last
// activities. What is shown is decided by the server from THEIR settings; this screen only displays it.
export default function CommunityProfileScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data, isLoading, isError, refetch } = useCommunityProfile(userId ?? "");
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();
  const firstName = data?.displayName.split(/\s+/)[0] ?? "";
  const busy = follow.isPending || unfollow.isPending;
  const actionError = (follow.error ?? unfollow.error)?.message ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.muted}>This profile isn&apos;t available.</Text>
          <Button title="Try again" variant="secondary" onPress={() => void refetch()} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(data.displayName)}</Text>
              </View>
              <Text style={styles.name}>{data.displayName}</Text>
              <Text style={styles.muted}>
                {[data.isStaff ? "Coach" : null, data.followsYou ? "Follows you" : null, formatMemberSince(data.detail?.memberSince) ? `Member since ${formatMemberSince(data.detail?.memberSince)}` : null]
                  .filter(Boolean)
                  .join(" · ") || " "}
              </Text>

              {data.isSelf ? (
                <Button title="Who sees my profile" variant="secondary" onPress={() => router.push("/community-privacy")} />
              ) : data.isFollowing ? (
                <Button
                  title="Following"
                  variant="secondary"
                  loading={busy}
                  onPress={() => {
                    tapFeedback();
                    unfollow.mutate(data.userId);
                  }}
                />
              ) : data.canFollow ? (
                <Button
                  title="Follow"
                  loading={busy}
                  onPress={() => {
                    tapFeedback();
                    follow.mutate(data.userId);
                  }}
                />
              ) : (
                <Text style={styles.muted}>{data.followBlockedReason ?? ""}</Text>
              )}
              {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
            </View>
          </Card>

          {data.detailHidden ? (
            <Card tier="quiet">
              <View style={styles.hidden}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} />
                <Text style={styles.muted}>
                  {data.canFollow && !data.detailLocked ? `${firstName} shares training details with followers. Follow to see them.` : `${firstName} keeps training details private.`}
                </Text>
              </View>
            </Card>
          ) : data.detail ? (
            <>
              {data.detail.stats ? (
                <View style={styles.statRow}>
                  {WINDOWS.map(({ key, label }) => {
                    const w = data.detail?.stats?.[key];
                    return (
                      <Card key={key} style={styles.statCard}>
                        <View style={styles.statBody}>
                          <Text style={styles.statLabel}>{label}</Text>
                          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                            {formatVolumeKg(w?.volumeKg ?? 0)}
                          </Text>
                          <Text style={styles.statSub}>{sessionsLabel(w?.sessions ?? 0)}</Text>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Last activities</Text>
              {data.detail.recent.length === 0 ? (
                <Card tier="quiet">
                  <Text style={[styles.muted, { padding: 16 }]}>Nothing shared yet.</Text>
                </Card>
              ) : (
                <Card>
                  {data.detail.recent.map((a, i) => (
                    <View key={a.id} style={[styles.activity, i > 0 && styles.activityDivider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityTitle} numberOfLines={1}>
                          {a.title}
                        </Text>
                        <Text style={styles.muted}>
                          {a.exerciseCount > 0 ? `${a.exerciseCount} ${a.exerciseCount === 1 ? "exercise" : "exercises"}` : null}
                          {a.exerciseCount > 0 && a.distanceKm ? " · " : null}
                          {a.distanceKm ? `${a.distanceKm} km` : null}
                        </Text>
                      </View>
                      <Text style={styles.muted}>{formatCommunityDate(a.date, "compact")}</Text>
                    </View>
                  ))}
                </Card>
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: AppSpace.gutter, paddingVertical: 8 },
    back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { ...appTitle(20, c.text), fontSize: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    scroll: { padding: AppSpace.gutter, gap: AppSpace.gap, paddingBottom: 48 },
    muted: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    error: { color: c.danger, fontSize: 13 },
    identity: { alignItems: "center", gap: 10, padding: 20 },
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    avatarText: { color: c.text, fontSize: 26, fontWeight: "700" },
    name: { color: c.text, fontSize: 22, fontWeight: "700", textAlign: "center" },
    hidden: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
    statRow: { flexDirection: "row", gap: AppSpace.gap },
    statCard: { flex: 1 },
    statBody: { padding: 12, gap: 4 },
    statLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    statValue: { color: c.text, fontSize: 17, fontWeight: "700" },
    statSub: { color: c.textSecondary, fontSize: 12 },
    sectionTitle: { color: c.text, fontSize: 17, fontWeight: "700", marginTop: 8 },
    activity: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    activityDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    activityTitle: { color: c.text, fontSize: 15, fontWeight: "600" },
  }),
);
