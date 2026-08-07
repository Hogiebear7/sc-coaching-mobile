// Local dev: the Metro/Expo dev server runs on your machine, but the app
// itself may run on a physical device or a simulator — `localhost` only
// resolves to "this machine" from the iOS Simulator. Android emulators use
// 10.0.2.2 for the host loopback; a physical phone needs your machine's LAN
// IP. Override via EXPO_PUBLIC_API_BASE_URL in .env.local for those cases.
// In production this points at the deployed sandccoaching.com API.
import { Platform } from "react-native";

function defaultDevBaseUrl(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:3001";
  return "http://localhost:3001";
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (__DEV__ ? defaultDevBaseUrl() : "https://sandccoaching.com");
