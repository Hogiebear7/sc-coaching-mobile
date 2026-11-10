import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuickActionSheet } from "@/components/app/QuickActionSheet";
import { TabSwapSheet } from "@/components/app/TabSwapSheet";
import { impactFeedback, selectionFeedback, successFeedback } from "@/lib/haptics";
import { useMemberTier } from "@/lib/queries/profile";
import {
  ALL_TAB_ROUTES,
  barTabsForTier,
  canChooseTabs,
  choosableTabsForTier,
  normaliseChoice,
  swapTab,
  swipeTabsForTier,
  type ChoosableTab,
  type TabRoute,
} from "@/lib/tab-config";
import { setTabChoice, useSyncTabChoiceWithAccount, useTabChoice } from "@/lib/tab-choice";
import { tourTarget } from "@/lib/tour-registry";
import { makeStyles, useAppTheme } from "@/lib/theme";

// App v2 tab bar (docs/design-inspiration-macrofactor-2026-10.md). The two
// tabs either side of the centre "+" are the member's own choice from
// Schedule, Train and Nutrition (lib/tab-config.ts, lib/tab-choice.ts):
// long-press either one to swap it, or change both in Settings. The "+" is not a screen — it opens the quick-action sheet.
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

// Horizontal swipe between the four screen tabs. Generous threshold so it
// never fights horizontal scrollers inside screens. Made once; the tab bar
// keeps swipeState current (the tab order is the member's own choice).
const swipeState: { order: string[]; path: string; push: (href: string) => void } = { order: [], path: "", push: () => {} };
function updateSwipeState(order: string[], path: string, push: (href: string) => void) {
  swipeState.order = order;
  swipeState.path = path;
  swipeState.push = push;
}
const tabSwipeResponder = PanResponder.create({
  onMoveShouldSetPanResponderCapture: (_evt, { dx, dy }) => Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2,
  onPanResponderRelease: (_evt, { dx }) => {
    const idx = swipeState.order.indexOf(currentSegment(swipeState.path));
    if (idx === -1) return;
    const next = dx < 0 ? swipeState.order[idx + 1] : swipeState.order[idx - 1];
    if (!next) return;
    selectionFeedback();
    swipeState.push(hrefFor(next as TabRoute));
  },
});

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const tier = useMemberTier();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [swapping, setSwapping] = useState<ChoosableTab | null>(null);
  useSyncTabChoiceWithAccount();
  const storedChoice = useTabChoice();
  const choice = normaliseChoice(storedChoice, tier);

  const bar = barTabsForTier(tier, choice);
  const swipe = swipeTabsForTier(tier, choice);
  const swipeKey = swipe.join(",");
  const swapOptions = choosableTabsForTier(tier).filter((t) => !choice.includes(t));
  // Bar routes first, in bar order (Tabs renders in declaration order),
  // then the rest hidden.
  const ordered = [...bar, ...ALL_TAB_ROUTES.filter((r) => !bar.includes(r))];

  // Keep the shared swipe handler pointed at this render's tab order/route.
  useEffect(() => {
    updateSwipeState(swipeKey.split(","), pathname, (href) => router.push(href as never));
  }, [swipeKey, pathname, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} {...tabSwipeResponder.panHandlers}>
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
            // Room for Android's gesture bar / iOS home indicator: a fixed
            // height would sit the labels on top of it.
            height: 64 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom + 4,
          },
          // Fills the bar exactly; the app tour spotlights this to point at the tab bar.
          tabBarBackground: () => <View pointerEvents="none" style={StyleSheet.absoluteFill} {...tourTarget("tabs.bar")} />,
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
                      {...tourTarget("tabs.add")}
                      style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.96 }] }]}
                    >
                      <Ionicons name="add" size={30} color={colors.onPrimary} />
                    </Pressable>
                  </View>
                ),
              }}
            />
          ) : (
            <Tabs.Screen
              key={name}
              name={name}
              options={
                !bar.includes(name)
                  ? { href: null }
                  : canChooseTabs(tier) && (choice as string[]).includes(name)
                    ? {
                        // Long-press opens the swap sheet; a normal tap still switches tab.
                        tabBarButton: (props) => (
                          <Pressable
                            {...(props as unknown as PressableProps)}
                            delayLongPress={350}
                            onLongPress={() => {
                              impactFeedback();
                              setSwapping(name as ChoosableTab);
                            }}
                          />
                        ),
                      }
                    : undefined
              }
            />
          )
        )}
      </Tabs>
      <QuickActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      <TabSwapSheet
        tab={swapping}
        options={swapOptions}
        onChoose={(into) => {
          if (swapping) setTabChoice(swapTab(choice, swapping, into, tier));
          successFeedback();
          setSwapping(null);
        }}
        onSettings={() => {
          setSwapping(null);
          // Let the sheet finish closing before navigating (one transition at a time).
          setTimeout(() => router.push("/settings" as never), 250);
        }}
        onClose={() => setSwapping(null)}
      />
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
