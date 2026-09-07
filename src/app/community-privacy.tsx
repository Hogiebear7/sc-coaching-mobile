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
  const leaderboardVisible = data?.leaderboardVisible ?? true;
  const showRealName = data?.showRealName ?? true;

  function update(next: { leaderboardVisible: boolean; showRealName: boolean }) {
    setPrivacy.mutate(next);
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
            Visible by default — turn either of these off any time. Following someone always shows
            them your workouts (mark one private from its own screen if you don&apos;t want that);
            these two only control the leaderboard.
          </Text>

          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Show me on leaderboards</Text>
                <Text style={styles.settingSub}>Turn off to leave every Community leaderboard entirely.</Text>
              </View>
              <Switch
                value={leaderboardVisible}
                onValueChange={(v) => update({ leaderboardVisible: v, showRealName })}
                trackColor={{ false: Color.surface3, true: Color.gold }}
                thumbColor={Color.textPrimary}
                disabled={setPrivacy.isPending}
              />
            </View>
            <View style={[styles.settingRow, styles.settingRowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Show my real name</Text>
                <Text style={styles.settingSub}>
                  Turn off to appear as first name + last initial instead (e.g. &quot;Jamie F.&quot;).
                </Text>
              </View>
              <Switch
                value={showRealName}
                onValueChange={(v) => update({ leaderboardVisible, showRealName: v })}
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
