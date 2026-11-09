import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChallengeList } from "@/components/ui/ChallengeList";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemberSafetySheet } from "@/components/ui/MemberSafetySheet";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { MAX_MEMBERS_PER_GROUP, formatInviteCode, groupInviteMessage } from "@/lib/community-groups-format";
import { tapFeedback } from "@/lib/haptics";
import { useChallenges, useCloseGroup, useGroup, useLeaveGroup, useRemoveGroupMember } from "@/lib/queries/community-groups";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// One group: its invite code (organiser only), challenges, members, and leave / close.
export default function CommunityGroupScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = typeof id === "string" ? id : "";

  const group = useGroup(groupId);
  const challenges = useChallenges({ type: "group", id: groupId }, !!groupId && group.isSuccess);
  const leave = useLeaveGroup();
  const close = useCloseGroup();
  const removeMember = useRemoveGroupMember(groupId);
  const [safetyTarget, setSafetyTarget] = useState<{ userId: string; name: string } | null>(null);

  const g = group.data;

  function confirmLeave() {
    Alert.alert("Leave this group?", "You can rejoin later with the invite code.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          leave.mutate(groupId, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert("Couldn't leave", e.message),
          }),
      },
    ]);
  }

  function confirmClose() {
    Alert.alert(
      "Close this group?",
      "Everyone is removed and its challenges end. This can't be undone, and the invite code stops working.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Close group",
          style: "destructive",
          onPress: () =>
            close.mutate(groupId, {
              onSuccess: () => router.back(),
              onError: (e) => Alert.alert("Couldn't close the group", e.message),
            }),
        },
      ]
    );
  }

  function confirmRemove(userId: string, name: string) {
    Alert.alert(`Remove ${name}?`, "They can rejoin only with the invite code.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeMember.mutate(userId, { onError: (e) => Alert.alert("Couldn't remove them", e.message) }),
      },
    ]);
  }

  async function shareInvite() {
    if (!g?.inviteCode) return;
    tapFeedback();
    try {
      await Share.share({ message: groupInviteMessage(g.name, g.inviteCode) });
    } catch {
      // The share sheet closing or failing is not an error worth showing.
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {g?.name ?? "Group"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {group.isLoading ? (
        <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.xl }} />
      ) : group.isError || !g ? (
        <View style={styles.scroll}>
          <EmptyState
            icon="alert-circle-outline"
            title="Group not found"
            body={group.error?.message ?? "It may have been closed, or you may have been removed."}
            actionLabel="Back to groups"
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={group.isRefetching}
              onRefresh={() => {
                group.refetch();
                challenges.refetch();
              }}
              tintColor={Color.gold}
            />
          }
        >
          {g.description ? <Text style={styles.description}>{g.description}</Text> : null}
          <Text style={styles.meta}>
            {g.memberCount} of {MAX_MEMBERS_PER_GROUP} members
          </Text>

          {g.isOrganiser && g.inviteCode ? (
            <Card style={styles.inviteCard}>
              <Text style={styles.inviteLabel}>Invite code</Text>
              <Text style={styles.inviteCode} selectable accessibilityLabel={`Invite code ${g.inviteCode.split("").join(" ")}`}>
                {formatInviteCode(g.inviteCode)}
              </Text>
              <Text style={styles.inviteHint}>Anyone with this code can join, so only share it with people you want in.</Text>
              <Button title="Share invite" variant="secondary" onPress={shareInvite} style={{ marginTop: Spacing.sm }} />
            </Card>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              label="Challenges"
              action={g.isOrganiser ? { label: "New challenge", onPress: () => router.push({ pathname: "/community/new-challenge", params: { groupId } }) } : undefined}
            />
            {challenges.isLoading ? (
              <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.md }} />
            ) : (challenges.data ?? []).length === 0 ? (
              <EmptyState
                icon="trophy-outline"
                title="No challenges yet"
                body={g.isOrganiser ? "Set one and everyone's logged workouts count towards it automatically." : "The organiser can set one. Your logged workouts count automatically."}
              />
            ) : (
              <ChallengeList
                challenges={challenges.data ?? []}
                onOpen={(c) =>
                  router.push({ pathname: "/community/challenge", params: { scope: "group", groupId, challengeId: c.id } })
                }
              />
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader label="Members" />
            <Card style={styles.membersCard}>
              {g.members.map((m, i) => {
                const isMe = m.userId === user?.id;
                return (
                  <View key={m.userId} style={[styles.memberRow, i > 0 && styles.memberDivider]}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {isMe ? "You" : m.displayName}
                      {m.isOrganiser ? "  ·  Organiser" : ""}
                    </Text>
                    {!isMe ? (
                      <View style={styles.memberActions}>
                        {g.isOrganiser ? (
                          <Pressable
                            onPress={() => confirmRemove(m.userId, m.displayName)}
                            hitSlop={8}
                            style={styles.memberAction}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${m.displayName}`}
                          >
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => setSafetyTarget({ userId: m.userId, name: m.displayName })}
                          hitSlop={8}
                          style={styles.memberAction}
                          accessibilityRole="button"
                          accessibilityLabel={`Block or report ${m.displayName}`}
                        >
                          <Ionicons name="ellipsis-horizontal" size={20} color={Color.textFaint} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </View>

          <View style={styles.dangerZone}>
            {g.isOrganiser ? (
              <Button title="Close group" variant="secondary" onPress={confirmClose} loading={close.isPending} />
            ) : (
              <Button title="Leave group" variant="secondary" onPress={confirmLeave} loading={leave.isPending} />
            )}
          </View>
        </ScrollView>
      )}

      {safetyTarget ? (
        <MemberSafetySheet
          visible
          onClose={() => setSafetyTarget(null)}
          memberUserId={safetyTarget.userId}
          memberName={safetyTarget.name}
        />
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    description: { fontSize: 15, color: Color.textSecondary, lineHeight: 21 },
    meta: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
    inviteCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
    inviteLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textFaint },
    inviteCode: { fontSize: 28, fontWeight: "700", color: Color.gold, letterSpacing: 2, marginTop: Spacing.xs, fontVariant: ["tabular-nums"] },
    inviteHint: { fontSize: 13, color: Color.textMuted, lineHeight: 18, marginTop: Spacing.xs },
    section: { marginBottom: Spacing.xl },
    membersCard: { padding: 0, overflow: "hidden" },
    memberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 52 },
    memberDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    memberName: { flex: 1, fontSize: 15, fontWeight: "600", color: Color.textPrimary },
    memberActions: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    memberAction: { minHeight: 40, minWidth: 40, alignItems: "center", justifyContent: "center" },
    removeText: { fontSize: 14, fontWeight: "600", color: Color.gold },
    dangerZone: { marginTop: Spacing.sm },
  })
);
