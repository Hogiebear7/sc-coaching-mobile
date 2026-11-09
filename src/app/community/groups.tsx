import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdultConfirmSheet } from "@/components/ui/AdultConfirmSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextField } from "@/components/ui/TextField";
import { UpsellCard } from "@/components/ui/Upsell";
import { Radius, Spacing } from "@/constants/theme";
import {
  MAX_GROUPS_PER_ORGANISER,
  MAX_GROUP_DESCRIPTION,
  MAX_GROUP_NAME,
  extractInviteCode,
} from "@/lib/community-groups-format";
import { tapFeedback } from "@/lib/haptics";
import {
  isAdultConfirmationRequired,
  useAdultConfirmed,
  useCreateGroup,
  useGroups,
  useJoinGroup,
} from "@/lib/queries/community-groups";
import { useHasFeature } from "@/lib/queries/profile";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

type Panel = "none" | "create" | "join";

// Private groups: made by a member on the App plan, joined only with the organiser's invite code (no search, so a group is never public).
export default function CommunityGroupsScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const allowed = useHasFeature("communityGroups");
  const adult = useAdultConfirmed();
  const groups = useGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();

  const [panel, setPanel] = useState<Panel>("none");
  const [ageSheet, setAgeSheet] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");

  const needsAdult = allowed && adult.data === false;
  const organised = (groups.data ?? []).filter((g) => g.isOrganiser).length;

  function openPanel(next: Panel) {
    tapFeedback();
    if (needsAdult) {
      setAgeSheet(true);
      return;
    }
    setPanel(next);
  }

  function failure(e: Error, fallback: string) {
    if (isAdultConfirmationRequired(e)) {
      setAgeSheet(true);
      return;
    }
    Alert.alert(fallback, e.message);
  }

  function submitCreate() {
    createGroup.mutate(
      { name: name.trim(), description: description.trim() },
      {
        onSuccess: (group) => {
          setPanel("none");
          setName("");
          setDescription("");
          router.push({ pathname: "/community/group/[id]", params: { id: group.id } });
        },
        onError: (e) => failure(e, "Couldn't create the group"),
      }
    );
  }

  function submitJoin() {
    joinGroup.mutate(extractInviteCode(code), {
      onSuccess: (group) => {
        setPanel("none");
        setCode("");
        router.push({ pathname: "/community/group/[id]", params: { id: group.id } });
      },
      onError: (e) => failure(e, "Couldn't join"),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={{ width: 36 }} />
      </View>

      {!allowed ? (
        <View style={styles.scroll}>
          <UpsellCard
            icon="people-circle-outline"
            title="Groups"
            body="Start a private group with friends, set challenges and see who comes out on top. Part of the App Subscription."
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={groups.isRefetching} onRefresh={() => groups.refetch()} tintColor={Color.gold} />}
        >
          <Text style={styles.subhead}>Private groups for people you train with. You join with an invite code from the organiser.</Text>

          <View style={styles.actions}>
            <Button title="Join with a code" variant="secondary" onPress={() => openPanel("join")} style={styles.actionButton} />
            <Button
              title="Create a group"
              onPress={() => openPanel("create")}
              disabled={organised >= MAX_GROUPS_PER_ORGANISER}
              style={styles.actionButton}
            />
          </View>
          {organised >= MAX_GROUPS_PER_ORGANISER ? (
            <Text style={styles.limitNote}>You organise {MAX_GROUPS_PER_ORGANISER} groups, which is the most. Close one to start another.</Text>
          ) : null}

          {needsAdult ? (
            <Card style={styles.gateCard}>
              <Text style={styles.gateTitle}>One quick step</Text>
              <Text style={styles.gateBody}>Groups are for members aged 18 or over. Confirm once and you can join or create groups.</Text>
              <Button title="Confirm I'm 18 or over" onPress={() => setAgeSheet(true)} style={{ marginTop: Spacing.sm }} />
            </Card>
          ) : groups.isLoading ? (
            <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.lg }} />
          ) : groups.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load your groups"
              body={groups.error.message}
              actionLabel="Try again"
              onAction={() => groups.refetch()}
            />
          ) : (groups.data ?? []).length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No groups yet"
              body="Create one and share its code, or join a friend's group with theirs."
            />
          ) : (
            <Card style={styles.listCard}>
              {(groups.data ?? []).map((g, i) => (
                <Pressable
                  key={g.id}
                  onPress={() => router.push({ pathname: "/community/group/[id]", params: { id: g.id } })}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.name}, ${g.memberCount} members`}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={styles.rowSub}>
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                      {g.isOrganiser ? " · You organise this" : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      <Modal visible={panel !== "none"} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPanel("none")}>
        <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
          <View style={styles.sheet}>
            {panel === "create" ? (
              <>
                <Text style={styles.sheetTitle}>Create a group</Text>
                <TextField label="Group name" value={name} onChangeText={(t) => setName(t.slice(0, MAX_GROUP_NAME))} placeholder="e.g. Sunday Lifters" />
                <TextField
                  label="Description (optional)"
                  value={description}
                  onChangeText={(t) => setDescription(t.slice(0, MAX_GROUP_DESCRIPTION))}
                  placeholder="What is this group for?"
                  multiline
                  style={{ height: 84, paddingTop: 12, textAlignVertical: "top" }}
                />
                <Button title="Create group" onPress={submitCreate} loading={createGroup.isPending} disabled={name.trim().length === 0} />
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Join with a code</Text>
                <Text style={styles.sheetBody}>Enter the code the organiser sent you. You can paste their whole message.</Text>
                <TextField label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="ABCD-2345" />
                <Button title="Join group" onPress={submitJoin} loading={joinGroup.isPending} disabled={extractInviteCode(code).length < 8} />
              </>
            )}
            <Pressable onPress={() => setPanel("none")} hitSlop={8} style={styles.cancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdultConfirmSheet visible={ageSheet} onClose={() => setAgeSheet(false)} onConfirmed={() => setAgeSheet(false)} what="groups" />
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    subhead: { fontSize: 14, color: Color.textMuted, marginBottom: Spacing.md },
    actions: { flexDirection: "row", gap: Spacing.sm },
    actionButton: { flex: 1, paddingHorizontal: Spacing.sm },
    limitNote: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm },
    gateCard: { marginTop: Spacing.lg, padding: Spacing.lg },
    gateTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    gateBody: { fontSize: 14, color: Color.textSecondary, lineHeight: 20, marginTop: Spacing.xs },
    listCard: { padding: 0, overflow: "hidden", marginTop: Spacing.lg },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 60 },
    rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    rowMain: { flex: 1 },
    rowTitle: { fontSize: 16, fontWeight: "600", color: Color.textPrimary },
    rowSub: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    backdrop: { flex: 1, backgroundColor: "rgba(4,10,20,0.72)", justifyContent: "center", padding: Spacing.xl },
    sheet: { borderRadius: Radius.lg, backgroundColor: Color.surface1, padding: Spacing.lg },
    sheetTitle: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
    sheetBody: { fontSize: 14, color: Color.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
    cancel: { marginTop: Spacing.md, alignSelf: "center", minHeight: 40, justifyContent: "center" },
    cancelText: { fontSize: 14, fontWeight: "500", color: Color.textFaint, textDecorationLine: "underline" },
  })
);
