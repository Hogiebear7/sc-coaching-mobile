import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Same signed-token format the web app already uses for its session cookie
// (see lib/session.ts in the main repo) — the mobile app just carries it as
// a Bearer header instead of a cookie. SecureStore is iOS Keychain /
// Android Keystore-backed, appropriate for an auth token — but it has no
// web implementation (there's no OS keychain in a browser), so this app's
// web target (react-native-web, used for quick preview/dev — the real
// targets are iOS/Android) falls back to localStorage instead of crashing.
const TOKEN_KEY = "sc_session_token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return window.localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
