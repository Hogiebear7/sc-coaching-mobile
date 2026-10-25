import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { selectionFeedback } from "@/lib/haptics";
import { useStaffMessageThreads } from "@/lib/queries/staff";
import { makeStyles, useAppTheme } from "@/lib/theme";

// Staff/admin get a completely separate tab set from members — coaches
// don't have a ProfileRecord (profiles are member-owned; see
// MEMBER_OWNED_COLLECTIONS in the main repo's lib/db.ts), so reusing the
// member tabs (which all assume a profile exists) isn't just wrong UX, it'd
// hit "no profile found" errors. Root _layout.tsx's AuthGate routes staff
// roles here instead of (tabs).
//
// App v2: same bar language as the member tabs — outline/filled icon pair,
// the gold brand dot over the active tab, safe-area aware height.
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ["calendar-outline", "calendar"],
  workouts: ["albums-outline", "albums"],
  members: ["people-outline", "people"],
  "staff-messages": ["chatbubble-ellipses-outline", "chatbubble-ellipses"],
};

const LABELS: Record<string, string> = {
  index: "Classes",
  workouts: "Workouts",
  members: "Members",
  "staff-messages": "Messages",
};

export default function StaffTabsLayout() {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { data: threads } = useStaffMessageThreads();
  const unreadCount = threads?.reduce((sum, t) => sum + t.unreadFromMemberCount, 0) ?? 0;

  return (
    <Tabs
      screenListeners={{ tabPress: () => selectionFeedback() }}
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 4,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
        tabBarBadgeStyle: { backgroundColor: colors.brand, color: "#0a1526", fontSize: 11, fontWeight: "700" },
        tabBarIcon: ({ color, focused }) => {
          const pair = ICONS[route.name] ?? ["ellipse-outline", "ellipse"];
          return (
            <View style={{ alignItems: "center" }}>
              <Ionicons name={focused ? pair[1] : pair[0]} size={24} color={color} />
              {focused ? <View style={styles.brandDot} /> : null}
            </View>
          );
        },
        title: LABELS[route.name] ?? route.name,
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="members" />
      <Tabs.Screen name="staff-messages" options={{ tabBarBadge: unreadCount > 0 ? unreadCount : undefined }} />
    </Tabs>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    brandDot: { position: "absolute", top: -9, width: 4, height: 4, borderRadius: 2, backgroundColor: c.brand },
  })
);
