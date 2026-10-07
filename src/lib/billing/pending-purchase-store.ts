import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { PendingPurchaseStore } from "./types";

// Keeps a purchased-but-unverified token across an app restart. A purchase token is sensitive (it is proof of a
// paid subscription), so it lives in SecureStore (Keystore-backed), never AsyncStorage, never logged. Keyed by the
// signed-in account so one account's pending purchase is never retried under another.
//
// Android only in practice: SecureStore has no web implementation, and the billing client is unavailable on web.
export function createPendingPurchaseStore(userId: string): PendingPurchaseStore {
  // SecureStore keys allow only letters, digits, ".", "-" and "_".
  const key = `sc_pending_play_purchase_${userId.replace(/[^A-Za-z0-9._-]/g, "_")}`;
  const supported = Platform.OS === "android";

  return {
    async load() {
      return supported ? SecureStore.getItemAsync(key) : null;
    },
    async save(purchaseToken) {
      if (supported) await SecureStore.setItemAsync(key, purchaseToken);
    },
    async clear() {
      if (supported) await SecureStore.deleteItemAsync(key);
    },
  };
}
