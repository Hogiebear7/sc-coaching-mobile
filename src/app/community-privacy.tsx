import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import { useCommunityPrivacy, useSetCommunityPrivacy } from "@/lib/queries/community";

export default function CommunityPrivacyScreen() {
  const router = useRouter();
  const { data, isLoading } = useCommunityPrivacy();
  const setPrivacy = useSetCommunityPrivacy();

  // data is the single source of truth — no local state mirroring it, so
  // there's nothing to resync via an effect. A toggle just mutates and
  // waits for the query to refetch (useSetCommunityPrivacy already
  // invalidates it on success).
  const discoverable = data?.discoverable ?? true;
  const leaderboardVisible = data?.leaderboardVisible ?? true;
  const showRealName = data?.showRealName ?? true;

  function update(next: Partial<{ discoverable: boolean; leaderboardVisible: boolean; showRealName: boolean }>) {
    setPrivacy.mutate({ discoverable, leaderboardVisible, showRealName, ...next });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Community privacy</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            These are independent — you can, for example, stay off the leaderboard and still be
            followable, or the reverse. All three are on by default.
          </Text>

          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Show me in search and suggestions</Text>
                <Text style={styles.settingSub}>
                  Other members can find you by name and see you as someone to follow. Turn this off
                  and new people won&apos;t find you — but anyone already following you isn&apos;t
                  affected, and you can still search for and follow others yourself.
                </Text>
              </View>
              <Switch
                value={discoverable}
                onValueChange={(v) => update({ discoverable: v })}
                trackColor={{ false: Color.surface3, true: Color.gold }}
                thumbColor={Color.textPrimary}
                disabled={setPrivacy.isPending}
              />
            </View>
            <View style={[styles.settingRow, styles.settingRowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Show me on leaderboards</Text>
                <Text style={styles.settingSub}>
                  Include your lifts and rankings in Community leaderboards. Turn this off to keep
                  your numbers out of every leaderboard.
                </Text>
              </View>
              <Switch
                value={leaderboardVisible}
                onValueChange={(v) => update({ leaderboardVisible: v })}
                trackColor={{ false: Color.surface3, true: Color.gold }}
                thumbColor={Color.textPrimary}
                disabled={setPrivacy.isPending}
              />
            </View>
            <View style={[styles.settingRow, styles.settingRowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Show my full name</Text>
                <Text style={styles.settingSub}>
                  Use your full name wherever you appear in Community — leaderboards, search,
                  suggestions. Turn this off to show your first name and last initial instead.
                </Text>
              </View>
              <Switch
                value={showRealName}
                onValueChange={(v) => update({ showRealName: v })}
                trackColor={{ false: Color.surface3, true: Color.gold }}
                thumbColor={Color.textPrimary}
                disabled={setPrivacy.isPending}
              />
            </View>
          </Card>
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
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  intro: { fontSize: 12, color: Color.textSecondary, lineHeight: 17, marginBottom: Spacing.lg },
  card: { padding: Spacing.md },
  settingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  settingRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  settingTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  settingSub: { fontSize: 12, color: Color.textMuted, marginTop: 2, lineHeight: 16 },
});
