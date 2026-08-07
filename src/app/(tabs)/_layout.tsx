import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { Color } from "@/constants/theme";

// Same 5 tabs, same order, as the web app's BottomNavBar
// (app/(dashboard)/dashboard/bottom-nav.tsx): Home, Schedule, Workouts,
// Recovery, Nutrition. Declared explicitly via <Tabs.Screen> rather than
// left to file-based auto-discovery — Expo Router's directory-order
// fallback isn't guaranteed to match filename order across platforms.
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  schedule: "calendar-outline",
  workouts: "barbell-outline",
  recovery: "heart-outline",
  nutrition: "nutrition-outline",
};

const LABELS: Record<string, string> = {
  index: "Home",
  schedule: "Schedule",
  workouts: "Workouts",
  recovery: "Recovery",
  nutrition: "Nutrition",
};

export default function TabsLayout() {
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
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="recovery" />
      <Tabs.Screen name="nutrition" />
    </Tabs>
  );
}
