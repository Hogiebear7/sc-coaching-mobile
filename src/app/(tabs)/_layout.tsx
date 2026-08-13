import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Animated, Easing } from "react-native";

import { Color } from "@/constants/theme";

// A page-turn-style transition between the 5 tabs, built on expo-router's
// built-in bottom-tabs scene interpolator hook (the same mechanism behind
// its stock "shift"/"fade" presets) rather than a third-party page-flip
// library — those are mostly unmaintained and render unreliably on
// Android. `current.progress` runs -1 (scene now to the left of the
// active tab) → 0 (active) → 1 (scene to the right), driven continuously
// by the same Animated.timing each tab press starts, so every scene
// rotates and slides in the direction matching real tab order — moving
// right through the tabs reads as pages turning forward, and back again
// in reverse.
function pageTurnStyleInterpolator({ current }: { current: { progress: Animated.Value } }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        { perspective: 800 },
        {
          rotateY: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: ["-70deg", "0deg", "70deg"],
          }),
        },
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-60, 0, 60],
          }),
        },
      ],
    },
  };
}

const pageTurnTransitionSpec = {
  animation: "timing" as const,
  config: { duration: 220, easing: Easing.inOut(Easing.ease) },
};

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
        sceneStyleInterpolator: pageTurnStyleInterpolator,
        transitionSpec: pageTurnTransitionSpec,
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
