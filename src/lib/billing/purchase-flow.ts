// The Android App Subscription purchase flow as a pure state machine over injected dependencies.
//
// Rules this encodes (owner defaults, gym-app docs/iap-multitenant-implementation-plan-2026-10.md):
//  - The account binding comes from the SERVER, before anything is launched, and is passed to the store
//    unchanged. If the server will not give one, no purchase is started.
//  - The client never grants itself anything. A store "purchased" result is only a token to hand to the server.
//  - The client never acknowledges before the server has verified. finishVerified runs only after success.
//  - A purchased-but-unverified token is saved so a dropped connection never loses a paid purchase.
//  - Branch on the server's stable `code`, never its message.

import type { ApiFailure, BillingDeps, BillingOutcome, BlockedCode, RejectedCode, VerifyResult } from "./types";

const BLOCKED_CODES: ReadonlySet<string> = new Set<BlockedCode>(["membership_active", "play_billing_active"]);
const REJECTED_CODES: ReadonlySet<string> = new Set<RejectedCode>([
  "owned_by_other",
  "binding_required",
  "product_unknown",
  "provider_rejected",
  "invalid_request",
  "not_set_up",
]);

export const BLOCKED_COPY: Record<BlockedCode, string> = {
  membership_active: "You already have an active gym Membership, so an App Subscription can't be added while it is active.",
  play_billing_active: "You already have an App Subscription through Google Play.",
};

function isUnreachable(failure: ApiFailure): boolean {
  return failure.status === 0 || failure.status === 502 || failure.status === 504 || failure.code === "provider_unavailable";
}

// Maps a server refusal at the CONTEXT step (before anything is launched).
function mapContextFailure(failure: ApiFailure): BillingOutcome {
  if (failure.code === "iap_disabled") return { kind: "unavailable", reason: "disabled" };
  if (failure.code === "not_configured" || failure.code === "binding_unavailable") return { kind: "unavailable", reason: "not_configured" };
  if (failure.code && BLOCKED_CODES.has(failure.code)) {
    return { kind: "blocked", code: failure.code as BlockedCode, message: BLOCKED_COPY[failure.code as BlockedCode] };
  }
  if (isUnreachable(failure)) return { kind: "needs_retry", reason: "server_unreachable" };
  return { kind: "error", message: failure.message };
}

interface VerifyDecision {
  outcome: BillingOutcome;
  /** True when the saved token should be kept so verification can be retried. */
  keepToken: boolean;
}

// Maps the server's answer to a verify call. Pure.
export function mapVerifyResult(result: VerifyResult): VerifyDecision {
  if (result.ok) {
    return { outcome: { kind: "verified", purchase: { tier: result.tier, status: result.status, acknowledged: result.acknowledged } }, keepToken: false };
  }
  const code = result.code;
  if (code === "purchase_pending") return { outcome: { kind: "pending", where: "server" }, keepToken: true };
  // The kill switch can be turned off after a paid purchase. Keep the token: it is verified once purchases resume.
  if (code === "iap_disabled" || code === "not_configured") return { outcome: { kind: "needs_retry", reason: "server_unavailable" }, keepToken: true };
  if (isUnreachable(result)) return { outcome: { kind: "needs_retry", reason: "server_unreachable" }, keepToken: true };
  if (code && BLOCKED_CODES.has(code)) {
    // The purchase was made, but the server refuses it. Nothing was granted or acknowledged, so Google refunds it.
    return {
      outcome: { kind: "blocked", code: code as BlockedCode, message: `${BLOCKED_COPY[code as BlockedCode]} This purchase was not applied and Google will refund it.` },
      keepToken: false,
    };
  }
  if (code && REJECTED_CODES.has(code)) return { outcome: { kind: "rejected", code: code as RejectedCode, message: result.message }, keepToken: false };
  if (result.status === 401) return { outcome: { kind: "error", message: "You've been signed out. Sign in again to finish your purchase." }, keepToken: true };
  return { outcome: { kind: "error", message: result.message }, keepToken: true };
}

async function verifyAndSettle(deps: BillingDeps, purchaseToken: string): Promise<BillingOutcome> {
  const decision = mapVerifyResult(await deps.api.verifyPurchase(purchaseToken));
  if (decision.keepToken) {
    await deps.store.save(purchaseToken);
  } else {
    await deps.store.clear();
  }
  if (decision.outcome.kind === "verified") {
    try {
      await deps.client.finishVerified(purchaseToken);
    } catch {
      // Housekeeping only: the server already acknowledged. A failure here must never undo a verified purchase.
    }
  }
  return decision.outcome;
}

export interface PurchaseRequest {
  productId: string;
  basePlanId: string;
}

export async function runPurchase(deps: BillingDeps, request: PurchaseRequest): Promise<BillingOutcome> {
  const { client, api, store } = deps;
  if (!client.isAvailable()) return { kind: "unavailable", reason: "platform_or_library" };

  // 1. The binding, from the server, before anything is launched. No binding means no purchase.
  const context = await api.getPurchaseContext();
  if (!context.ok) return mapContextFailure(context);

  try {
    await client.connect();
  } catch {
    return { kind: "error", message: "Google Play isn't available right now. Try again shortly." };
  }

  try {
    // 2. Launch with the server's binding, unchanged.
    const launched = await client.launchSubscription({
      productId: request.productId,
      basePlanId: request.basePlanId,
      obfuscatedAccountId: context.obfuscatedAccountId,
    });

    switch (launched.kind) {
      case "cancelled":
        return { kind: "cancelled" };
      case "pending":
        return { kind: "pending", where: "store" };
      case "already_owned":
        return await restoreWithClient(deps, request.productId);
      case "error":
        return { kind: "error", message: "The purchase could not be completed. You have not been charged." };
      case "purchased": {
        // A token for a product we did not ask for is never sent to the server.
        if (launched.productId !== request.productId) {
          return { kind: "rejected", code: "product_mismatch", message: "This purchase could not be verified." };
        }
        // 3. Keep the token before the network call, so a dropped connection cannot lose a paid purchase.
        await store.save(launched.purchaseToken);
        // 4. Only the server decides what this purchase entitles.
        return await verifyAndSettle(deps, launched.purchaseToken);
      }
    }
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

async function restoreWithClient(deps: BillingDeps, productId: string): Promise<BillingOutcome> {
  const owned = (await deps.client.getOwnedPurchases()).filter((p) => p.productId === productId);
  if (owned.length === 0) return { kind: "nothing_to_restore" };

  let firstFailure: BillingOutcome | null = null;
  for (const purchase of owned) {
    const outcome = await verifyAndSettle(deps, purchase.purchaseToken);
    if (outcome.kind === "verified") return outcome;
    firstFailure ??= outcome;
  }
  return firstFailure ?? { kind: "nothing_to_restore" };
}

/** "Restore purchases": asks the store what this Google account owns and has the server verify it. */
export async function restorePurchases(deps: BillingDeps, productId: string): Promise<BillingOutcome> {
  if (!deps.client.isAvailable()) return { kind: "unavailable", reason: "platform_or_library" };
  try {
    await deps.client.connect();
  } catch {
    return { kind: "error", message: "Google Play isn't available right now. Try again shortly." };
  }
  try {
    return await restoreWithClient(deps, productId);
  } finally {
    await deps.client.disconnect().catch(() => undefined);
  }
}

/** Retries a purchase that was paid for but could not be confirmed (call on app start and on return to foreground). */
export async function resumePendingPurchase(deps: BillingDeps): Promise<BillingOutcome | null> {
  const token = await deps.store.load();
  if (!token) return null;
  return verifyAndSettle(deps, token);
}
