import "expo-router/entry";

import { Platform } from "react-native";

// The app's entry: Expo Router, plus (Android only) the handler that draws the home-screen widgets and takes their button taps while the app
// isn't open (src/widgets/android/task-handler.tsx).
if (Platform.OS === "android") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { widgetTaskHandler } = require("./src/widgets/android/task-handler");
  registerWidgetTaskHandler(widgetTaskHandler);
}
