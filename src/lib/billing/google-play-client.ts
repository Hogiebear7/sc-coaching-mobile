// BillingClient over the expo-iap native module (Google Play Billing), with the module INJECTED.
//
// This file imports no React Native or Expo code, so it is unit-tested with a fake module
// (__tests__/google-play-client.test.ts). The real module is loaded lazily in ./index.ts, and ONLY if it is
// installed: expo-iap is deliberately NOT a dependency of this app yet (see docs/android-play-billing.md), so
// until it is added, isAvailable() is false and no purchase UI is shown.
//
// The expo-iap surface used here (initConnection, endConnection, fetchProducts, requestPurchase,
// purchaseUpdatedListener, purchaseErrorListener, getAvailablePurchases, finishTransaction) was written from the
// library's published type definitions, NOT run on a device. It must be verified on the Play internal test track
// before release.
//
// Never log a purchase token, an offer token or the obfuscated account id.

import type { BillingClient, LaunchArgs, LaunchResult, OwnedPurchase } from "./types";

// The minimal shape of the module we depend on. Kept local so this file compiles without the package installed.
export interface ExpoIapLike {
  initConnection(): Promise<unknown>;
  endConnection(): Promise<unknown>;
  fetchProducts(args: { skus: string[]; type: "subs" }): Promise<unknown[] | null>;
  requestPurchase(args: {
    type: "subs";
    request: { google: { skus: string[]; obfuscatedAccountId: string; subscriptionOffers?: { sku: string; offerToken: string }[] } };
  }): Promise<unknown>;
  purchaseUpdatedListener(listener: (purchase: unknown) => void): { remove(): void };
  purchaseErrorListener(listener: (error: unknown) => void): { remove(): void };
  getAvailablePurchases(): Promise<unknown[]>;
  finishTransaction(args: { purchase: unknown; isConsumable?: boolean }): Promise<unknown>;
}

export interface GooglePlayClientOptions {
  /** Returns the native module, or null when it is not present in this build. */
  loadModule: () => ExpoIapLike | null;
  /** Platform.OS. The Play client only exists on Android. */
  platform: string;
  /** How long to wait for the store to answer a launch before giving up. */
  launchTimeoutMs?: number;
}

const DEFAULT_LAUNCH_TIMEOUT_MS = 5 * 60 * 1000;

interface PurchaseLike {
  productId?: string;
  purchaseToken?: string | null;
  purchaseState?: string;
  obfuscatedAccountIdAndroid?: string | null;
}

const asPurchase = (value: unknown): PurchaseLike => (value && typeof value === "object" ? (value as PurchaseLike) : {});

// expo-iap error codes (ErrorCode enum values).
const CODE_CANCELLED = "user-cancelled";
const CODE_ALREADY_OWNED = "already-owned";
const CODE_PENDING = "pending";

function errorCode(error: unknown): string {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : "unknown";
}

export function createGooglePlayClient(options: GooglePlayClientOptions): BillingClient {
  const timeoutMs = options.launchTimeoutMs ?? DEFAULT_LAUNCH_TIMEOUT_MS;
  const mod = (): ExpoIapLike | null => (options.platform === "android" ? options.loadModule() : null);

  return {
    isAvailable: () => mod() !== null,

    async connect() {
      const m = mod();
      if (!m) throw new Error("billing_unavailable");
      await m.initConnection();
    },

    async disconnect() {
      await mod()?.endConnection();
    },

    async launchSubscription(args: LaunchArgs): Promise<LaunchResult> {
      const m = mod();
      if (!m) return { kind: "error", code: "billing_unavailable" };

      // The store identifies a specific base plan by an offer token, found on the fetched product.
      let offerToken: string | null = null;
      try {
        const products = (await m.fetchProducts({ skus: [args.productId], type: "subs" })) ?? [];
        const product = products.find((p) => (p as { id?: string }).id === args.productId) as
          | { subscriptionOffers?: { basePlanIdAndroid?: string | null; offerTokenAndroid?: string | null }[] | null }
          | undefined;
        offerToken = product?.subscriptionOffers?.find((o) => o.basePlanIdAndroid === args.basePlanId)?.offerTokenAndroid ?? null;
      } catch {
        return { kind: "error", code: "fetch_products_failed" };
      }
      if (!offerToken) return { kind: "error", code: "offer_not_found" };

      return new Promise<LaunchResult>((resolve) => {
        let settled = false;
        const finish = (result: LaunchResult) => {
          if (settled) return;
          settled = true;
          updates.remove();
          errors.remove();
          clearTimeout(timer);
          resolve(result);
        };

        const updates = m.purchaseUpdatedListener((raw) => {
          const purchase = asPurchase(raw);
          // Ignore events for other products (for example an older purchase being replayed on connect).
          if (purchase.productId !== args.productId) return;
          if (purchase.purchaseState === "pending") return finish({ kind: "pending" });
          if (purchase.purchaseState === "purchased" && purchase.purchaseToken) {
            return finish({ kind: "purchased", purchaseToken: purchase.purchaseToken, productId: purchase.productId });
          }
        });
        const errors = m.purchaseErrorListener((error) => {
          const code = errorCode(error);
          if (code === CODE_CANCELLED) return finish({ kind: "cancelled" });
          if (code === CODE_ALREADY_OWNED) return finish({ kind: "already_owned" });
          if (code === CODE_PENDING) return finish({ kind: "pending" });
          finish({ kind: "error", code });
        });
        const timer = setTimeout(() => finish({ kind: "error", code: "timeout" }), timeoutMs);

        m.requestPurchase({
          type: "subs",
          request: {
            google: {
              skus: [args.productId],
              // Set BEFORE the purchase starts, exactly as the server issued it.
              obfuscatedAccountId: args.obfuscatedAccountId,
              subscriptionOffers: [{ sku: args.productId, offerToken: offerToken as string }],
            },
          },
        }).catch((error) => {
          const code = errorCode(error);
          finish(code === CODE_CANCELLED ? { kind: "cancelled" } : code === CODE_ALREADY_OWNED ? { kind: "already_owned" } : { kind: "error", code });
        });
      });
    },

    async getOwnedPurchases(): Promise<OwnedPurchase[]> {
      const m = mod();
      if (!m) return [];
      const purchases = await m.getAvailablePurchases();
      return purchases
        .map(asPurchase)
        .filter((p): p is PurchaseLike & { productId: string; purchaseToken: string } => !!p.productId && !!p.purchaseToken && p.purchaseState !== "pending")
        .map((p) => ({ purchaseToken: p.purchaseToken, productId: p.productId }));
    },

    async finishVerified(purchaseToken: string) {
      const m = mod();
      if (!m) return;
      const owned = (await m.getAvailablePurchases()).find((p) => asPurchase(p).purchaseToken === purchaseToken);
      if (!owned) return;
      // The server has already acknowledged. This only clears the store's queue, and the store tolerates a repeat.
      await m.finishTransaction({ purchase: owned, isConsumable: false });
    },
  };
}
