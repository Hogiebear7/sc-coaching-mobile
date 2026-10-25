import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageStyle } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/BrandMark";
import { AppRadius, AppSpace, appTitle } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/queries/profile";
import { makeStyles, useAppTheme } from "@/lib/theme";

type Row = { label: string; icon: keyof typeof Ionicons.glyphMap; href: string };

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Your training",
    rows: [
      { label: "Set up your plan", icon: "flag-outline", href: "/onboarding" },
      { label: "Recovery", icon: "heart-outline", href: "/(tabs)/recovery" },
      { label: "Nutrition", icon: "nutrition-outline", href: "/(tabs)/nutrition" },
      { label: "Readiness trend", icon: "pulse-outline", href: "/readiness" },
      { label: "Workout library", icon: "library-outline", href: "/workout-library" },
    ],
  },
  {
    title: "Club",
    rows: [
      { label: "Messages", icon: "chatbubble-ellipses-outline", href: "/messages" },
      { label: "Membership", icon: "card-outline", href: "/membership" },
      { label: "Community", icon: "people-outline", href: "/community" },
      { label: "Notifications", icon: "notifications-outline", href: "/notifications" },
    ],
  },
  {
    title: "Account",
    rows: [
      { label: "Profile", icon: "person-outline", href: "/profile" },
      { label: "Settings", icon: "settings-outline", href: "/settings" },
    ],
  },
];

// More (App v2 prototype): the profile and everything that isn't a tab, as
// grouped lists with an icon, label and chevron.
export default function MoreScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const name = profile?.fullName || user?.email || "Member";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Text style={appTitle(34, colors.text)}>More</Text>
          <BrandMark height={20} />
        </View>

        <Pressable onPress={() => router.push("/profile")} style={styles.profile} accessibilityRole="button">
          {profile?.avatarDataUrl ? (
            <Image source={{ uri: profile.avatarDataUrl }} style={styles.avatar as ImageStyle} contentFit="cover" />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {user?.email ? <Text style={styles.email} numberOfLines={1}>{user.email}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {GROUPS.map((g) => (
          <View key={g.title} style={styles.group}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.list}>
              {g.rows.map((r, i) => (
                <Pressable
                  key={r.label}
                  onPress={() => router.push(r.href as never)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name={r.icon} size={22} color={colors.text} />
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, dc, Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingBottom: 40 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 20 },
    profile: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 8, marginBottom: AppSpace.section },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    initials: { fontSize: 22, fontWeight: "700", color: colors.onPrimary },
    name: { fontSize: 20, fontWeight: "600", color: colors.text },
    email: { marginTop: 2, fontSize: 15, color: colors.textMuted },
    group: { marginBottom: AppSpace.section },
    groupTitle: { fontSize: 21, fontWeight: "600", color: colors.text, marginBottom: 12 },
    list: { backgroundColor: colors.surface, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 58, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
    rowLabel: { flex: 1, fontSize: 17, color: colors.text },
  })
);
