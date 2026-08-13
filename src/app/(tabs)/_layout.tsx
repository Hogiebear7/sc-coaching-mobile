import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Animated, Dimensions, Easing } from "react-native";

import { Color } from "@/constants/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;

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
//
// Tuned to read as an actual page flip rather than a tilt: rotation
// sweeps almost all the way to edge-on (88°) before the scene disappears,
// it travels a full half-screen so the page visibly swings toward its
// edge instead of just wobbling in place, and a shadow peaks mid-turn
// (the page "lifting" and catching light) then fades back to flat at
// rest — the cue that actually reads as paper turning, not a spin.
function pageTurnStyleInterpolator({ current }: { current: { progress: Animated.Value } }) {
  const progress = current.progress;
  return {
    sceneStyle: {
      opacity: progress.interpolate({
        inputRange: [-1, -0.3, 0, 0.3, 1],
        outputRange: [0, 1, 1, 1, 0],
      }),
      transform: [
        { perspective: 1000 },
        {
          rotateY: progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: ["-88deg", "0deg", "88deg"],
          }),
        },
        {
          translateX: progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
          }),
        },
      ],
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 16,
      shadowOpacity: progress.interpolate({
        inputRange: [-1, -0.6, -0.25, 0, 0.25, 0.6, 1],
        outputRange: [0, 0.45, 0.25, 0, 0.25, 0.45, 0],
      }),
      elevation: progress.interpolate({
        inputRange: [-1, -0.6, 0, 0.6, 1],
        outputRange: [0, 14, 0, 14, 0],
      }),
    },
  };
}

const pageTurnTransitionSpec = {
  animation: "timing" as const,
  config: { duration: 300, easing: Easing.inOut(Easing.ease) },
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
