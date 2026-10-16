// The app's calls to the server's billing routes. The server decides everything; this file only carries messages and turns an ApiError into the
// ServerBillingError (with the server's stable code) the purchase controller understands.

import { ApiError, apiFetch } from "@/lib/api-client";

import { ServerBillingError, type BillingApi, type CatalogPlan, type PurchaseBinding, type PurchaseProof, type StorePlatform, type VerifyResult } from "./types";

async function call<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError) throw new ServerBillingError(error.status, error.code, error.message);
    throw new ServerBillingError(0, null, "Can't reach the server.");
  }
}

export function createBillingApi(): BillingApi {
  return {
    async getCatalog(): Promise<CatalogPlan[]> {
      const res = await call<{ success: true; data: { plans: CatalogPlan[] } }>("/api/mobile/billing/catalog");
      return res.data.plans;
    },

    async getBinding(platform: StorePlatform): Promise<PurchaseBinding> {
      if (platform === "ios") {
        const res = await call<{ success: true; data: { appAccountToken: string } }>("/api/mobile/billing/app-store/purchase-context");
        return { platform: "ios", appAccountToken: res.data.appAccountToken };
      }
      const res = await call<{ success: true; data: { obfuscatedAccountId: string } }>("/api/mobile/billing/google-play/purchase-context");
      return { platform: "android", obfuscatedAccountId: res.data.obfuscatedAccountId };
    },

    async verify(proof: PurchaseProof): Promise<VerifyResult> {
      const res =
        proof.platform === "ios"
          ? await call<{ success: true; data: VerifyResult }>("/api/mobile/billing/app-store/verify", { method: "POST", body: { signedTransaction: proof.signedTransaction } })
          : await call<{ success: true; data: VerifyResult }>("/api/mobile/billing/google-play/verify", { method: "POST", body: { purchaseToken: proof.purchaseToken } });
      return res.data;
    },
  };
}
