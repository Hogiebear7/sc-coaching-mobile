// The App Subscription purchase flow (src/lib/billing/purchase-flow.ts), driven with fake dependencies: no native
// module, no network, no real purchase token. The server contract is gym-app docs/google-play-server-contract-2026-10.md.
import { describe, expect, it } from "vitest";

import { mapVerifyResult, resumePendingPurchase, restorePurchases, runPurchase } from "../purchase-flow";
import type { ApiFailure, BillingApi, BillingClient, LaunchArgs, LaunchResult, OwnedPurchase, PendingPurchaseStore, VerifyResult } from "../types";

const PRODUCT = "app_subscription";
const BINDING = "binding-from-server-0123456789abcdef";
const TOKEN = "fake-token-1";
const REQUEST = { productId: PRODUCT, basePlanId: "monthly" };

const failure = (status: number, code: string | null, message = "server message"): ApiFailure => ({ ok: false, status, code, message });
const verified: VerifyResult = { ok: true, tier: "app_subscription", status: "active", acknowledged: true };

interface Harness {
  calls: string[];
  launches: LaunchArgs[];
  verifies: string[];
  finished: string[];
  saved: () => string | null;
  deps: { client: BillingClient; api: BillingApi; store: PendingPurchaseStore };
}

function harness(opts: {
  available?: boolean;
  context?: Awaited<ReturnType<BillingApi["getPurchaseContext"]>>;
  launch?: LaunchResult;
  owned?: OwnedPurchase[];
  verify?: VerifyResult | VerifyResult[];
  connectFails?: boolean;
  finishFails?: boolean;
  initialToken?: string | null;
}): Harness {
  const calls: string[] = [];
  const launches: LaunchArgs[] = [];
  const verifies: string[] = [];
  const finished: string[] = [];
  let token = opts.initialToken ?? null;
  const verifyQueue = Array.isArray(opts.verify) ? [...opts.verify] : null;

  const client: BillingClient = {
    isAvailable: () => opts.available ?? true,
    async connect() {
      calls.push("connect");
      if (opts.connectFails) throw new Error("no play");
    },
    async disconnect() {
      calls.push("disconnect");
    },
    async launchSubscription(args) {
      calls.push("launch");
      launches.push(args);
      return opts.launch ?? { kind: "purchased", purchaseToken: TOKEN, productId: PRODUCT };
    },
    async getOwnedPurchases() {
      calls.push("owned");
      return opts.owned ?? [];
    },
    async finishVerified(t) {
      calls.push("finish");
      finished.push(t);
      if (opts.finishFails) throw new Error("finish failed");
    },
  };
  const api: BillingApi = {
    async getPurchaseContext() {
      calls.push("context");
      return opts.context ?? { ok: true, obfuscatedAccountId: BINDING };
    },
    async verifyPurchase(t) {
      calls.push("verify");
      verifies.push(t);
      return verifyQueue ? (verifyQueue.shift() ?? verified) : ((opts.verify as VerifyResult | undefined) ?? verified);
    },
  };
  const store: PendingPurchaseStore = {
    async load() {
      return token;
    },
    async save(t) {
      calls.push("save");
      token = t;
    },
    async clear() {
      calls.push("clear");
      token = null;
    },
  };
  return { calls, launches, verifies, finished, saved: () => token, deps: { client, api, store } };
}

describe("runPurchase: success", () => {
  it("fetches the binding FIRST, passes it to the store unchanged, then verifies with the server", async () => {
    const h = harness({});
    const outcome = await runPurchase(h.deps, REQUEST);

    expect(outcome).toEqual({ kind: "verified", purchase: { tier: "app_subscription", status: "active", acknowledged: true } });
    expect(h.launches).toEqual([{ productId: PRODUCT, basePlanId: "monthly", obfuscatedAccountId: BINDING }]);
    expect(h.calls.indexOf("context")).toBeLessThan(h.calls.indexOf("launch"));
    expect(h.verifies).toEqual([TOKEN]);
  });

  it("saves the token before the network call and clears it once verified, and finishes only after verification", async () => {
    const h = harness({});
    await runPurchase(h.deps, REQUEST);
    expect(h.calls.indexOf("save")).toBeLessThan(h.calls.indexOf("verify"));
    expect(h.calls.indexOf("verify")).toBeLessThan(h.calls.indexOf("finish"));
    expect(h.saved()).toBeNull();
    expect(h.finished).toEqual([TOKEN]);
    expect(h.calls.at(-1)).toBe("disconnect");
  });

  it("a failing finish step never undoes a verified purchase", async () => {
    const h = harness({ finishFails: true });
    expect((await runPurchase(h.deps, REQUEST)).kind).toBe("verified");
  });
});

describe("runPurchase: no purchase without the server's binding", () => {
  it.each([
    [failure(503, "iap_disabled"), { kind: "unavailable", reason: "disabled" }],
    [failure(503, "not_configured"), { kind: "unavailable", reason: "not_configured" }],
    [failure(503, "binding_unavailable"), { kind: "unavailable", reason: "not_configured" }],
  ])("%j never launches the store and reports it unavailable", async (ctx, expected) => {
    const h = harness({ context: ctx });
    expect(await runPurchase(h.deps, REQUEST)).toEqual(expected);
    expect(h.launches).toEqual([]);
    expect(h.calls).not.toContain("connect");
  });

  it.each(["membership_active", "play_billing_active"] as const)("%s blocks the purchase before the store is touched", async (code) => {
    const h = harness({ context: failure(409, code) });
    const outcome = await runPurchase(h.deps, REQUEST);
    expect(outcome).toMatchObject({ kind: "blocked", code });
    expect(h.launches).toEqual([]);
  });

  it("an unreachable server means no purchase and a retryable outcome", async () => {
    const h = harness({ context: failure(0, null) });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "needs_retry", reason: "server_unreachable" });
    expect(h.launches).toEqual([]);
  });

  it("is unavailable when the billing client is not present (off Android, or the module is missing)", async () => {
    const h = harness({ available: false });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "unavailable", reason: "platform_or_library" });
    expect(h.calls).toEqual([]);
  });

  it("reports an error and launches nothing when the store cannot connect", async () => {
    const h = harness({ connectFails: true });
    expect((await runPurchase(h.deps, REQUEST)).kind).toBe("error");
    expect(h.launches).toEqual([]);
  });
});

describe("runPurchase: store outcomes", () => {
  it("cancelled: nothing is verified or saved", async () => {
    const h = harness({ launch: { kind: "cancelled" } });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "cancelled" });
    expect(h.verifies).toEqual([]);
    expect(h.saved()).toBeNull();
  });

  it("pending at the store: no entitlement and no server verification", async () => {
    const h = harness({ launch: { kind: "pending" } });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "pending", where: "store" });
    expect(h.verifies).toEqual([]);
  });

  it("a store error reassures the member and verifies nothing", async () => {
    const h = harness({ launch: { kind: "error", code: "network-error" } });
    const outcome = await runPurchase(h.deps, REQUEST);
    expect(outcome.kind).toBe("error");
    expect(h.verifies).toEqual([]);
  });

  it("never sends a token for a product it did not ask for", async () => {
    const h = harness({ launch: { kind: "purchased", purchaseToken: TOKEN, productId: "some_other_product" } });
    expect(await runPurchase(h.deps, REQUEST)).toMatchObject({ kind: "rejected", code: "product_mismatch" });
    expect(h.verifies).toEqual([]);
  });

  it("already owned: restores through the server instead of failing", async () => {
    const h = harness({ launch: { kind: "already_owned" }, owned: [{ purchaseToken: TOKEN, productId: PRODUCT }] });
    const outcome = await runPurchase(h.deps, REQUEST);
    expect(outcome.kind).toBe("verified");
    expect(h.verifies).toEqual([TOKEN]);
  });

  it("already owned with nothing the store will list: nothing to restore", async () => {
    const h = harness({ launch: { kind: "already_owned" }, owned: [] });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "nothing_to_restore" });
  });
});

describe("backend rejection and server delay", () => {
  it.each(["owned_by_other", "binding_required", "product_unknown", "provider_rejected", "invalid_request", "not_set_up"] as const)(
    "%s is a rejection: the saved token is cleared and not retried",
    async (code) => {
      const h = harness({ verify: failure(409, code, "safe text") });
      const outcome = await runPurchase(h.deps, REQUEST);
      expect(outcome).toMatchObject({ kind: "rejected", code });
      expect(h.saved()).toBeNull();
      expect(h.finished).toEqual([]);
    }
  );

  it.each(["membership_active", "play_billing_active"] as const)("%s after payment: blocked, token cleared, and the member is told Google will refund", async (code) => {
    const h = harness({ verify: failure(409, code) });
    const outcome = await runPurchase(h.deps, REQUEST);
    expect(outcome).toMatchObject({ kind: "blocked", code });
    expect((outcome as { message: string }).message).toMatch(/refund/i);
    expect(h.saved()).toBeNull();
  });

  it.each([
    ["unreachable", failure(0, null)],
    ["provider unavailable", failure(502, "provider_unavailable")],
  ])("%s: the paid token is KEPT for retry and nothing is acknowledged", async (_label, result) => {
    const h = harness({ verify: result });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "needs_retry", reason: "server_unreachable" });
    expect(h.saved()).toBe(TOKEN);
    expect(h.finished).toEqual([]);
  });

  it("the server still confirming (purchase_pending) keeps the token and reports pending at the server", async () => {
    const h = harness({ verify: failure(409, "purchase_pending") });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "pending", where: "server" });
    expect(h.saved()).toBe(TOKEN);
  });

  it("purchases switched off server-side after payment keeps the token for when they resume", async () => {
    const h = harness({ verify: failure(503, "iap_disabled") });
    expect(await runPurchase(h.deps, REQUEST)).toEqual({ kind: "needs_retry", reason: "server_unavailable" });
    expect(h.saved()).toBe(TOKEN);
  });

  it("a signed-out session keeps the token and says so", async () => {
    const h = harness({ verify: failure(401, null) });
    const outcome = await runPurchase(h.deps, REQUEST);
    expect(outcome.kind).toBe("error");
    expect(h.saved()).toBe(TOKEN);
  });

  it("branches on the stable code, never the message text", async () => {
    const a = mapVerifyResult(failure(409, "owned_by_other", "totally different words"));
    const b = mapVerifyResult(failure(409, "owned_by_other", "another message"));
    expect(a.outcome).toMatchObject({ kind: "rejected", code: "owned_by_other" });
    expect(b.outcome).toMatchObject({ kind: "rejected", code: "owned_by_other" });
    expect(mapVerifyResult(failure(409, null, "This purchase is already linked to another account.")).outcome.kind).toBe("error");
  });
});

describe("resumePendingPurchase (server entitlement delay)", () => {
  it("does nothing when no token is waiting", async () => {
    const h = harness({});
    expect(await resumePendingPurchase(h.deps)).toBeNull();
    expect(h.verifies).toEqual([]);
  });

  it("verifies a waiting token and clears it on success", async () => {
    const h = harness({ initialToken: TOKEN });
    expect((await resumePendingPurchase(h.deps))?.kind).toBe("verified");
    expect(h.verifies).toEqual([TOKEN]);
    expect(h.saved()).toBeNull();
  });

  it("keeps the token through repeated delays, then completes", async () => {
    const h = harness({ initialToken: TOKEN, verify: [failure(502, "provider_unavailable"), failure(409, "purchase_pending"), verified] });
    expect((await resumePendingPurchase(h.deps))?.kind).toBe("needs_retry");
    expect(h.saved()).toBe(TOKEN);
    expect((await resumePendingPurchase(h.deps))?.kind).toBe("pending");
    expect(h.saved()).toBe(TOKEN);
    expect((await resumePendingPurchase(h.deps))?.kind).toBe("verified");
    expect(h.saved()).toBeNull();
  });

  it("drops a waiting token the server refuses, so it is never retried forever", async () => {
    const h = harness({ initialToken: TOKEN, verify: failure(409, "binding_required") });
    expect((await resumePendingPurchase(h.deps))?.kind).toBe("rejected");
    expect(h.saved()).toBeNull();
  });
});

describe("restorePurchases", () => {
  it("verifies owned purchases for the product only, and returns the first that verifies", async () => {
    const h = harness({
      owned: [
        { purchaseToken: "other-product-token", productId: "other" },
        { purchaseToken: "old-token", productId: PRODUCT },
        { purchaseToken: TOKEN, productId: PRODUCT },
      ],
      verify: [failure(409, "provider_rejected"), verified],
    });
    expect((await restorePurchases(h.deps, PRODUCT)).kind).toBe("verified");
    expect(h.verifies).toEqual(["old-token", TOKEN]);
  });

  it("reports nothing to restore when the store lists nothing for the product", async () => {
    const h = harness({ owned: [{ purchaseToken: "x", productId: "other" }] });
    expect(await restorePurchases(h.deps, PRODUCT)).toEqual({ kind: "nothing_to_restore" });
    expect(h.verifies).toEqual([]);
  });

  it("reports the server's refusal when none verify", async () => {
    const h = harness({ owned: [{ purchaseToken: TOKEN, productId: PRODUCT }], verify: failure(409, "owned_by_other") });
    expect(await restorePurchases(h.deps, PRODUCT)).toMatchObject({ kind: "rejected", code: "owned_by_other" });
  });

  it("is unavailable without the billing client", async () => {
    expect(await restorePurchases(harness({ available: false }).deps, PRODUCT)).toEqual({ kind: "unavailable", reason: "platform_or_library" });
  });
});
