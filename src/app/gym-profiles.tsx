import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useGymProfiles, useSetActiveGymProfile, type GymProfile } from "@/lib/queries/gym-profiles";

function ProfileCard({
  profile,
  isActive,
  onPress,
  onSetActive,
  settingActive,
}: {
  profile: GymProfile;
  isActive: boolean;
  onPress: () => void;
  onSetActive: () => void;
  settingActive: boolean;
}) {
  return (
    <Card style={styles.profileCard}>
      <Pressable onPress={onPress} style={styles.profileCardMain}>
        <Text style={styles.profileIcon}>{profile.icon ?? "🏋️"}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.profileNameRow}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {isActive ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.profileMeta}>
            {profile.equipmentSlugs.length} item{profile.equipmentSlugs.length === 1 ? "" : "s"} selected
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
      </Pressable>
      {!isActive ? (
        <Pressable onPress={onSetActive} disabled={settingActive} style={styles.setActiveButton}>
          <Text style={styles.setActiveButtonText}>{settingActive ? "Setting…" : "Set as active"}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function GymProfilesScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useGymProfiles();
  const setActive = useSetActiveGymProfile();

  function handleSetActive(id: string) {
    tapFeedback();
    setActive.mutate(id);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Gym Profiles</Text>
        <Pressable onPress={() => router.push("/gym-profile-builder")} hitSlop={12} style={styles.addButton}>
          <Ionicons name="add" size={22} color={Color.gold} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your gym profiles.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          <Text style={styles.introText}>
            The active profile filters the exercise library and shapes workout suggestions to what
            you actually have access to. You can always browse everything regardless.
          </Text>

          {data.profiles.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={22} color={Color.textFaint} />
              <Text style={styles.emptyText}>No gym profiles yet.</Text>
              <Text style={styles.emptySub}>
                Add the equipment you have access to — at home, at your gym, or on the road.
              </Text>
              <Button
                title="Create a gym profile"
                onPress={() => router.push("/gym-profile-builder")}
                variant="secondary"
                style={{ marginTop: Spacing.sm }}
              />
            </Card>
          ) : (
            data.profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isActive={profile.id === data.activeGymProfileId}
                onPress={() => router.push({ pathname: "/gym-profile-builder", params: { profileId: profile.id } })}
                onSetActive={() => handleSetActive(profile.id)}
                settingActive={setActive.isPending}
              />
            ))
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
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  addButton: { padding: 4 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.xs },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  introText: { fontSize: 12, color: Color.textMuted, marginBottom: Spacing.md, lineHeight: 17 },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: 4 },
  emptyText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary, marginTop: Spacing.xs },
  emptySub: { fontSize: 12, color: Color.textMuted, textAlign: "center" },
  profileCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  profileCardMain: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  profileIcon: { fontSize: 26 },
  profileNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  activeBadge: { borderRadius: Radius.pill, backgroundColor: Color.goldWeak, borderWidth: 1, borderColor: Color.goldBorder, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { fontSize: 10, fontWeight: "700", color: Color.gold },
  profileMeta: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  setActiveButton: { marginTop: Spacing.sm, alignSelf: "flex-start", borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  setActiveButtonText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
});
