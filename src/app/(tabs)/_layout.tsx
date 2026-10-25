import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";

import { QuickActionSheet } from "@/components/app/QuickActionSheet";
import { AppColor } from "@/constants/theme";

// App v2 tab bar (prototype, docs/design-inspiration-macrofactor-2026-10.md):
// Home · Schedule · (+) · Train · More. The centre "+" is not a screen — it
// opens the quick-action sheet. Recovery and Nutrition stay as routes in this
// group (every existing link to them keeps working) but leave the bar; they
// are reached from Home tiles, the "+" sheet and More.
const SWIPE_ROUTES = ["/(tabs)", "/(tabs)/schedule", "/(tabs)/workouts", "/(tabs)/more"];
const SWIPE_SEGMENTS = ["index", "schedule", "workouts", "more"];

function currentTabIndex(pathname: string): number {
  const segment = pathname.replace(/^\/+|\/+$/g, "") || "index";
  return SWIPE_SEGMENTS.indexOf(segment);
}

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ["grid-outline", "grid"],
  schedule: ["calendar-outline", "calendar"],
  workouts: ["barbell-outline", "barbell"],
  more: ["ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle"],
};

const LABELS: Record<string, string> = {
  index: "Home",
  schedule: "Schedule",
  workouts: "Train",
  more: "More",
};

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Horizontal swipe between the four screen tabs. Generous threshold so it
  // never fights horizontal scrollers inside screens.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, { dx, dy }) => Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2,
        onPanResponderRelease: (_evt, { dx }) => {
          const idx = currentTabIndex(pathname);
          if (idx === -1) return;
          if (dx < 0 && idx < SWIPE_ROUTES.length - 1) router.push(SWIPE_ROUTES[idx + 1] as never);
          else if (dx > 0 && idx > 0) router.push(SWIPE_ROUTES[idx - 1] as never);
        },
      }),
    [pathname, router]
  );

  return (
    <View style={{ flex: 1, backgroundColor: AppColor.bg }} {...panResponder.panHandlers}>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: { backgroundColor: AppColor.bg },
          tabBarActiveTintColor: AppColor.text,
          tabBarInactiveTintColor: AppColor.textMuted,
          tabBarStyle: {
            backgroundColor: AppColor.bg,
            borderTopColor: AppColor.hairline,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 72,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
          tabBarIcon: ({ color, focused }) => {
            const pair = ICONS[route.name];
            return pair ? (
              <View style={{ alignItems: "center" }}>
                <Ionicons name={focused ? pair[1] : pair[0]} size={24} color={color} />
                {focused ? <View style={styles.brandDot} /> : null}
              </View>
            ) : null;
          },
          title: LABELS[route.name] ?? route.name,
        })}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="schedule" />
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            tabBarButton: () => (
              <View style={styles.addSlot}>
                <Pressable
                  onPress={() => setSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Log something"
                  style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.96 }] }]}
                >
                  <Ionicons name="add" size={30} color={AppColor.onPrimary} />
                </Pressable>
              </View>
            ),
          }}
        />
        <Tabs.Screen name="workouts" />
        <Tabs.Screen name="more" />
        <Tabs.Screen name="recovery" options={{ href: null }} />
        <Tabs.Screen name="nutrition" options={{ href: null }} />
      </Tabs>
      <QuickActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandDot: { position: "absolute", top: -9, width: 4, height: 4, borderRadius: 2, backgroundColor: AppColor.brand },
  addSlot: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: AppColor.primary, alignItems: "center", justifyContent: "center", marginTop: -6 },
});
