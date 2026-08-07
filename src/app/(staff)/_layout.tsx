import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { Color } from "@/constants/theme";

// Staff/admin get a completely separate tab set from members — coaches
// don't have a ProfileRecord (profiles are member-owned; see
// MEMBER_OWNED_COLLECTIONS in the main repo's lib/db.ts), so reusing the
// member tabs (which all assume a profile exists) isn't just wrong UX, it'd
// hit "no profile found" errors. Root _layout.tsx's AuthGate routes staff
// roles here instead of (tabs).
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "calendar-outline",
  members: "people-outline",
  business: "stats-chart-outline",
};

const LABELS: Record<string, string> = {
  index: "Classes",
  members: "Members",
  business: "Business",
};

export default function StaffTabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Color.gold,
        tabBarInactiveTintColor: Color.textFaint,
        tabBarStyle: {
          backgroundColor: Color.surface1,
          borderTopColor: Color.borderSubtle,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name] ?? "ellipse-outline"} size={size - 2} color={color} />
        ),
        title: LABELS[route.name] ?? route.name,
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="members" />
      <Tabs.Screen name="business" />
    </Tabs>
  );
}
