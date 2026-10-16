// StoreBilling over expo-iap (StoreKit 2 on iOS, Google Play Billing on Android). This is the ONLY file that touches the native library, and it is loaded
// lazily so a build or runtime without the native module (Expo Go, the web preview) simply reports billing as unavailable instead of crashing.
//
// STATUS: written against expo-iap 6.0.2's published type declarations and NOT yet run on a device or against a store sandbox. Everything above this
// file (the purchase lifecycle, the paywall's rules) is tested with fakes; what this file does inside the real library is exactly the part that only a
// store-sandbox test can prove. See docs/subscription-sandbox-test-plan in the owner folder.
//
// Deliberate choices:
//  - iOS: the purchase is NOT finished automatically (andDangerouslyFinishTransactionAutomatically: false). The controller finishes it after the SERVER accepted it.
//  - iOS: appAccountToken is set on every purchase; the server refuses a purchase that does not carry the signed-in account's token.
//  - Android: obfuscatedAccountId is set on every purchase for the same reason. finish() is a NO-OP on Android: the SERVER acknowledges the purchase after
//    it has written the entitlement, so a client-side acknowledge must never run first.
//  - The signed transaction (iOS) and purchase token (Android) are passed to the server and nowhere else. No third-party verification service is used.

import { Platform } from "react-native";

import { matchStorePlans, type RawStoreProduct } from "./plans";
import { BillingError, type BillingErrorCode, type CatalogPlan, type PurchaseBinding, type PurchaseProof, type StoreBilling, type StorePlan, type StorePlatform } from "./types";

// The slice of expo-iap this file uses, declared locally so the app type-checks without the native package installed in every environment.
interface IapPurchase {
  id?: string;
  productId: string;
  purchaseToken?: string | null;
  purchaseState?: "pending" | "purchased" | "unknown";
  platform?: string;
  isAcknowledgedAndroid?: boolean | null;
  transactionId?: string;
}
interface IapOffer {
  id?: string | null;
  basePlanIdAndroid?: string | null;
  offerTokenAndroid?: string | null;
  displayPrice?: string;
  pricingPhasesAndroid?: { pricingPhaseList?: unknown[] } | null;
}
interface IapProduct {
  id: string;
  title?: string;
  displayName?: string | null;
  displayPrice?: string;
  subscriptionOffers?: IapOffer[];
}
interface IapModule {
  initConnection(): Promise<boolean>;
  endConnection(): Promise<boolean>;
  fetchProducts(args: { skus: string[]; type: "subs" }): Promise<IapProduct[] | null>;
  requestPurchase(args: { request: unknown; type: "subs" }): Promise<unknown>;
  finishTransaction(args: { purchase: IapPurchase; isConsumable?: boolean }): Promise<void>;
  getAvailablePurchases(args?: unknown): Promise<IapPurchase[]>;
  purchaseUpdatedListener(listener: (purchase: IapPurchase) => void): { remove: () => void };
  purchaseErrorListener(listener: (error: { code?: string; message?: string }) => void): { remove: () => void };
  deepLinkToSubscriptions(args?: { skuAndroid?: string; packageNameAndroid?: string }): Promise<void>;
}

function loadModule(): IapModule | null {
  try {
    // A static string so Metro bundles it; wrapped so a missing native module is "billing unavailable", not a crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load on purpose (see above)
    return require("expo-iap") as IapModule;
  } catch {
    return null;
  }
}

const ERROR_MAP: Record<string, BillingErrorCode> = {
  "user-cancelled": "cancelled",
  "deferred-payment": "pending",
  pending: "pending",
  "already-owned": "already_owned",
  "item-unavailable": "product_unavailable",
  "sku-not-found": "product_unavailable",
  "empty-sku-list": "product_unavailable",
  "billing-unavailable": "unavailable",
  "iap-not-available": "unavailable",
  "service-disconnected": "unavailable",
  "feature-not-supported": "unavailable",
  "network-error": "network",
  "service-timeout": "network",
};

export function mapStoreErrorCode(code: string | undefined): BillingErrorCode {
  return (code && ERROR_MAP[code]) || "unknown";
}

export function createExpoIapBilling(platform: StorePlatform = Platform.OS === "ios" ? "ios" : "android"): StoreBilling {
  let iap: IapModule | null = null;
  let connected = false;
  const purchaseListeners = new Set<(p: PurchaseProof) => void>();
  const errorListeners = new Set<(e: BillingError) => void>();
  let subscriptions: { remove: () => void }[] = [];

  function toProof(p: IapPurchase): PurchaseProof | null {
    const key = p.id ?? p.transactionId ?? p.purchaseToken ?? "";
    if (!p.purchaseToken || !key) return null;
    // iOS: purchaseToken is the signed transaction (JWS). Android: purchaseToken is the purchase token.
    return platform === "ios"
      ? { platform, productId: p.productId, signedTransaction: p.purchaseToken, key, native: p }
      : { platform, productId: p.productId, purchaseToken: p.purchaseToken, key, native: p };
  }

  function attachListeners() {
    if (!iap || subscriptions.length > 0) return;
    subscriptions = [
      iap.purchaseUpdatedListener((p) => {
        // A pending purchase (Ask to Buy, slow payment) is reported as pending, not offered to the server.
        if (p.purchaseState === "pending") {
          for (const l of errorListeners) l(new BillingError("pending"));
          return;
        }
        const proof = toProof(p);
        if (proof) for (const l of purchaseListeners) l(proof);
      }),
      iap.purchaseErrorListener((e) => {
        for (const l of errorListeners) l(new BillingError(mapStoreErrorCode(e.code), e.code ?? "unknown"));
      }),
    ];
  }

  return {
    platform,

    async connect() {
      if (connected) return true;
      iap = iap ?? loadModule();
      if (!iap) return false;
      try {
        connected = await iap.initConnection();
        if (connected) attachListeners();
        return connected;
      } catch {
        connected = false;
        return false;
      }
    },

    async disconnect() {
      for (const s of subscriptions) s.remove();
      subscriptions = [];
      connected = false;
      try {
        await iap?.endConnection();
      } catch {
        // already closed
      }
    },

    async loadPlans(catalog: CatalogPlan[]): Promise<StorePlan[]> {
      if (!iap) return [];
      const skus = [...new Set(catalog.map((c) => (platform === "ios" ? c.appStoreProductId : c.googlePlayProductId)).filter((s): s is string => !!s))];
      if (skus.length === 0) return [];
      const products = (await iap.fetchProducts({ skus, type: "subs" })) ?? [];
      const raw: RawStoreProduct[] = products.map((p) => ({
        id: p.id,
        title: p.displayName || p.title || "",
        displayPrice: p.displayPrice ?? "",
        offers:
          platform === "android"
            ? (p.subscriptionOffers ?? []).map((o) => ({
                basePlanId: o.basePlanIdAndroid ?? null,
                offerToken: o.offerTokenAndroid ?? null,
                // A base plan offer has no promotional phases; a trial or introductory offer has more than one pricing phase.
                isBasePlanOffer: (o.pricingPhasesAndroid?.pricingPhaseList?.length ?? 1) <= 1 && !o.id,
                displayPrice: o.displayPrice ?? "",
              }))
            : undefined,
      }));
      return matchStorePlans(platform, catalog, raw);
    },

    async startPurchase(plan: StorePlan, binding: PurchaseBinding) {
      if (!iap) throw new BillingError("unavailable");
      try {
        if (binding.platform === "ios") {
          await iap.requestPurchase({
            type: "subs",
            request: { apple: { sku: plan.productId, appAccountToken: binding.appAccountToken, andDangerouslyFinishTransactionAutomatically: false } },
          });
        } else {
          if (!plan.offerToken) throw new BillingError("product_unavailable");
          await iap.requestPurchase({
            type: "subs",
            request: { google: { skus: [plan.productId], obfuscatedAccountId: binding.obfuscatedAccountId, subscriptionOffers: [{ sku: plan.productId, offerToken: plan.offerToken }] } },
          });
        }
      } catch (error) {
        if (error instanceof BillingError) throw error;
        const code = (error as { code?: string } | null)?.code;
        throw new BillingError(mapStoreErrorCode(code), code ?? "unknown");
      }
    },

    async getOwned(catalog: CatalogPlan[]): Promise<PurchaseProof[]> {
      if (!iap) return [];
      const ours = new Set(catalog.map((c) => (platform === "ios" ? c.appStoreProductId : c.googlePlayProductId)).filter((s): s is string => !!s));
      const purchases = await iap.getAvailablePurchases();
      return purchases
        .filter((p) => ours.has(p.productId) && p.purchaseState !== "pending")
        .map(toProof)
        .filter((p): p is PurchaseProof => p !== null);
    },

    async finish(proof: PurchaseProof) {
      // Android: the server acknowledges after it has written the entitlement. Nothing to do here, and a client acknowledge must never run first.
      if (platform !== "ios" || !iap) return;
      await iap.finishTransaction({ purchase: proof.native as IapPurchase, isConsumable: false });
    },

    async openManagement(plan) {
      if (!iap) return;
      await iap.deepLinkToSubscriptions(platform === "android" ? { skuAndroid: plan?.productId, packageNameAndroid: ANDROID_PACKAGE } : undefined);
    },

    onPurchase(listener) {
      purchaseListeners.add(listener);
      return () => purchaseListeners.delete(listener);
    },

    onError(listener) {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
  };
}

// Mirrors app.json android.package; used only to open this app's subscription page in Google Play.
const ANDROID_PACKAGE = "com.sandcperformancecoaching.app";
