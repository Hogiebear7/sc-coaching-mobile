import * as SecureStore from "expo-secure-store";

// Same signed-token format the web app already uses for its session cookie
// (see lib/session.ts in the main repo) — the mobile app just carries it as
// a Bearer header instead of a cookie. SecureStore is iOS Keychain /
// Android Keystore-backed, appropriate for an auth token.
const TOKEN_KEY = "sc_session_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
