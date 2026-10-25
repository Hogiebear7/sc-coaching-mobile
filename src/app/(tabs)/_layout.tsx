import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";

import { QuickActionSheet } from "@/components/app/QuickActionSheet";
import { impactFeedback, selectionFeedback } from "@/lib/haptics";
import { useMemberTier } from "@/lib/queries/profile";
import { ALL_TAB_ROUTES, barTabsForTier, swipeTabsForTier, type TabRoute } from "@/lib/tab-config";
import { makeStyles, useAppTheme } from "@/lib/theme";

// App v2 tab bar (docs/design-inspiration-macrofactor-2026-10.md). Which
// four screens sit around the centre "+" depends on the member's tier (see
// lib/tab-config.ts): gym members get Schedule, app-only members get
// Nutrition. The "+" is not a screen — it opens the quick-action sheet.
// Routes left out of the bar stay registered (href: null), so every
// existing link to them keeps working.
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ["grid-outline", "grid"],
  schedule: ["calendar-outline", "calendar"],
  workouts: ["barbell-outline", "barbell"],
  nutrition: ["restaurant-outline", "restaurant"],
  recovery: ["heart-outline", "heart"],
  more: ["ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle"],
};

const LABELS: Record<string, string> = {
  index: "Home",
  schedule: "Schedule",
  workouts: "Train",
  nutrition: "Nutrition",
  recovery: "Recovery",
  more: "More",
};

function hrefFor(route: TabRoute): string {
  return route === "index" ? "/(tabs)" : `/(tabs)/${route}`;
}

function currentSegment(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, "") || "index";
}

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const tier = useMemberTier();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const [sheetOpen, setSheetOpen] = useState(false);

  const bar = barTabsForTier(tier);
  const swipe = useMemo(() => swipeTabsForTier(tier), [tier]);
  // Bar routes first, in bar order (Tabs renders in declaration order),
  // then the rest hidden.
  const ordered = [...bar, ...ALL_TAB_ROUTES.filter((r) => !bar.includes(r))];

  // Horizontal swipe between the four screen tabs. Generous threshold so it
  // never fights horizontal scrollers inside screens.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, { dx, dy }) => Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2,
        onPanResponderRelease: (_evt, { dx }) => {
          const idx = swipe.indexOf(currentSegment(pathname) as TabRoute);
          if (idx === -1) return;
          const next = dx < 0 ? swipe[idx + 1] : swipe[idx - 1];
          if (!next) return;
          selectionFeedback();
          router.push(hrefFor(next) as never);
        },
      }),
    [pathname, router, swipe]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} {...panResponder.panHandlers}>
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
        {ordered.map((name) =>
          name === "add" ? (
            <Tabs.Screen
              key="add"
              name="add"
              options={{
                title: "",
                tabBarButton: () => (
                  <View style={styles.addSlot}>
                    <Pressable
                      onPress={() => {
                        impactFeedback();
                        setSheetOpen(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Log something"
                      style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.96 }] }]}
                    >
                      <Ionicons name="add" size={30} color={colors.onPrimary} />
                    </Pressable>
                  </View>
                ),
              }}
            />
          ) : (
            <Tabs.Screen key={name} name={name} options={bar.includes(name) ? undefined : { href: null }} />
          )
        )}
      </Tabs>
      <QuickActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    brandDot: { position: "absolute", top: -9, width: 4, height: 4, borderRadius: 2, backgroundColor: c.brand },
    addSlot: { flex: 1, alignItems: "center", justifyContent: "center" },
    addBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", marginTop: -6 },
  })
);
