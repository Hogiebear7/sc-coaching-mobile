import { ApiError, apiFetch } from "@/lib/api-client";

import type { ApiFailure, BillingApi, PurchaseContextResult, VerifyResult } from "./types";

// The real BillingApi: two calls to the gym-app server. The client sends ONLY the purchase token. It never sends a
// user id, a gym id or an account binding: the server derives identity from the signed session, and the binding
// comes back from Google. A failure is reported as data (status + stable code), never thrown, so the purchase flow
// can branch on the code. Never log a token or a binding.

function toFailure(error: unknown): ApiFailure {
  if (error instanceof ApiError) return { ok: false, status: error.status, code: error.code, message: error.message };
  return { ok: false, status: 0, code: null, message: "Can't reach the server. Check your connection and try again." };
}

export const billingApi: BillingApi = {
  async getPurchaseContext(): Promise<PurchaseContextResult> {
    try {
      const res = await apiFetch<{ success: true; data: { obfuscatedAccountId: string } }>("/api/mobile/billing/google-play/purchase-context");
      const id = res.data?.obfuscatedAccountId;
      if (typeof id !== "string" || id.length === 0) return { ok: false, status: 200, code: null, message: "Unexpected response from the server." };
      return { ok: true, obfuscatedAccountId: id };
    } catch (e) {
      return toFailure(e);
    }
  },

  async verifyPurchase(purchaseToken: string): Promise<VerifyResult> {
    try {
      const res = await apiFetch<{ success: true; data: { tier: string; status: string; acknowledged: boolean } }>(
        "/api/mobile/billing/google-play/verify",
        { method: "POST", body: { purchaseToken } }
      );
      return { ok: true, tier: res.data.tier, status: res.data.status, acknowledged: !!res.data.acknowledged };
    } catch (e) {
      return toFailure(e);
    }
  },
};
