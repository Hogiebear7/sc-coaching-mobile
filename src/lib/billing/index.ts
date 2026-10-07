import { Platform } from "react-native";

import { billingApi } from "./billing-api";
import { createGooglePlayClient, type ExpoIapLike } from "./google-play-client";
import type { BillingClient } from "./types";

// App Subscription product, from public (non-secret) build configuration. Unset means purchases are unavailable and
// no purchase UI is shown. The server also refuses everything while its own kill switch is off.
export const APP_SUBSCRIPTION_PRODUCT_ID = process.env.EXPO_PUBLIC_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID ?? "";

// The base plans the server seeds under that one product (gym-app scripts/seed-app-subscription-package.mjs).
export const APP_SUBSCRIPTION_BASE_PLANS = [
  { id: "monthly", label: "Monthly" },
  { id: "semiannual", label: "Every 6 months" },
  { id: "annual", label: "Yearly" },
] as const;

// Loads the native billing module ONLY if this build contains it. expo-iap is intentionally not yet a dependency of
// this app, so this returns null today and isAvailable() is false. A dynamic require inside try/catch keeps Metro and
// the app working whether or not the package is installed.
function loadNativeModule(): ExpoIapLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-iap") as ExpoIapLike;
  } catch {
    return null;
  }
}

let client: BillingClient | null = null;

export function getBillingClient(): BillingClient {
  client ??= createGooglePlayClient({ loadModule: loadNativeModule, platform: Platform.OS });
  return client;
}

export function isAppSubscriptionPurchaseConfigured(): boolean {
  return APP_SUBSCRIPTION_PRODUCT_ID.length > 0 && getBillingClient().isAvailable();
}

export { billingApi };
export * from "./purchase-flow";
export type * from "./types";
