// The purchase lifecycle with fakes for the store and the server. No native code, no network. Proves what the controller is for: access only ever comes from the
// server's answer; a purchase is finished only after the server accepted it; a refused purchase is never looped; the account binding is fetched for the
// signed-in account right before a purchase; Restore and launch recovery are honest and bounded.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingController } from "@/lib/billing/controller";
import {
  BillingError,
  ServerBillingError,
  type BillingApi,
  type CatalogPlan,
  type PurchaseBinding,
  type PurchaseProof,
  type StoreBilling,
  type StorePlan,
  type StorePlatform,
  type VerifyResult,
} from "@/lib/billing/types";

const CATALOG: CatalogPlan[] = [
  { billingOptionId: "opt-m", intervalUnit: "month", intervalCount: 1, appStoreProductId: "apple.monthly", googlePlayProductId: "play_sub", googlePlayBasePlanId: "monthly" },
];
const PLAN: StorePlan = { billingOptionId: "opt-m", productId: "apple.monthly", title: "App Subscription", displayPrice: "£12.99", periodLabel: "per month", intervalUnit: "month", intervalCount: 1, basePlanId: null, offerToken: null };
const proof = (key = "tx-1", over: Partial<PurchaseProof> = {}): PurchaseProof => ({ platform: "ios", productId: "apple.monthly", signedTransaction: `jws-${key}`, key, native: { key }, ...over });
const VERIFIED: VerifyResult = { access: { digital: true, gymMembership: false }, plan: { source: "app_store", status: "active", currentPeriodEnd: "2026-12-01T00:00:00.000Z", autoRenewing: true, environment: "production" }, status: "active" };

class FakeBilling implements StoreBilling {
  platform: StorePlatform = "ios";
  connectResult = true;
  plans: StorePlan[] = [PLAN];
  owned: PurchaseProof[] = [];
  startError: BillingError | null = null;
  finishError: Error | null = null;
  readonly log: string[] = [];
  readonly finished: string[] = [];
  readonly started: { plan: StorePlan; binding: PurchaseBinding }[] = [];
  private purchaseListeners = new Set<(p: PurchaseProof) => void>();
  private errorListeners = new Set<(e: BillingError) => void>();

  async connect() {
    this.log.push("connect");
    return this.connectResult;
  }
  async disconnect() {
    this.log.push("disconnect");
  }
  async loadPlans() {
    return this.plans;
  }
  async startPurchase(plan: StorePlan, binding: PurchaseBinding) {
    this.log.push("startPurchase");
    if (this.startError) throw this.startError;
    this.started.push({ plan, binding });
  }
  async getOwned() {
    this.log.push("getOwned");
    return this.owned;
  }
  async finish(p: PurchaseProof) {
    this.log.push(`finish:${p.key}`);
    if (this.finishError) throw this.finishError;
    this.finished.push(p.key);
  }
  async openManagement() {}
  onPurchase(l: (p: PurchaseProof) => void) {
    this.purchaseListeners.add(l);
    return () => this.purchaseListeners.delete(l);
  }
  onError(l: (e: BillingError) => void) {
    this.errorListeners.add(l);
    return () => this.errorListeners.delete(l);
  }
  emitPurchase(p: PurchaseProof) {
    for (const l of this.purchaseListeners) l(p);
  }
  emitError(e: BillingError) {
    for (const l of this.errorListeners) l(e);
  }
  get listenerCount() {
    return this.purchaseListeners.size + this.errorListeners.size;
  }
}

class FakeApi implements BillingApi {
  catalogError: Error | null = null;
  bindingError: Error | null = null;
  verifyResults: (VerifyResult | Error)[] = [];
  readonly verified: string[] = [];
  readonly order: string[] = [];
  bindingFor: PurchaseBinding = { platform: "ios", appAccountToken: "token-of-signed-in-user" };

  async getCatalog() {
    if (this.catalogError) throw this.catalogError;
    return CATALOG;
  }
  async getBinding(platform: StorePlatform) {
    this.order.push(`binding:${platform}`);
    if (this.bindingError) throw this.bindingError;
    return this.bindingFor;
  }
  async verify(p: PurchaseProof) {
    this.order.push(`verify:${p.key}`);
    this.verified.push(p.key);
    const next = this.verifyResults.length > 1 ? this.verifyResults.shift()! : this.verifyResults[0] ?? VERIFIED;
    if (next instanceof Error) throw next;
    return next;
  }
}

let billing: FakeBilling;
let api: FakeApi;
let changed: ReturnType<typeof vi.fn<() => void>>;
let controller: BillingController;

const server = (status: number, code: string | null, message = "x") => new ServerBillingError(status, code, message);

beforeEach(() => {
  billing = new FakeBilling();
  api = new FakeApi();
  changed = vi.fn<() => void>();
  controller = new BillingController({ billing, api, onAccessMayHaveChanged: changed });
});

describe("loading plans", () => {
  it("is ready with exactly the plans the STORE returned", async () => {
    await controller.load();
    expect(controller.snapshot()).toMatchObject({ phase: "ready", plans: [PLAN], unavailableReason: null });
  });

  it("is unavailable, with a retry, when billing cannot connect", async () => {
    billing.connectResult = false;
    await controller.load();
    expect(controller.snapshot()).toMatchObject({ phase: "unavailable", unavailableReason: "no_billing", retryable: true, plans: [] });
  });

  it("is unavailable when the store offers none of the catalog's products", async () => {
    billing.plans = [];
    await controller.load();
    expect(controller.snapshot()).toMatchObject({ phase: "unavailable", unavailableReason: "no_products" });
  });

  it("distinguishes 'no connection' from 'the server is not offering it'", async () => {
    api.catalogError = server(0, null);
    await controller.load();
    expect(controller.snapshot()).toMatchObject({ unavailableReason: "offline", retryable: true });

    api.catalogError = server(503, "iap_disabled");
    await controller.load();
    expect(controller.snapshot()).toMatchObject({ unavailableReason: "server" });
  });

  it("recovers on a second load", async () => {
    billing.connectResult = false;
    await controller.load();
    billing.connectResult = true;
    await controller.load();
    expect(controller.snapshot().phase).toBe("ready");
  });
});

describe("buying: the binding comes first, from the server, for the signed-in account", () => {
  beforeEach(() => controller.load());

  it("fetches the binding BEFORE the purchase sheet and carries it on the purchase", async () => {
    await controller.buy(PLAN);
    expect(api.order).toEqual(["binding:ios"]);
    expect(billing.log.indexOf("startPurchase")).toBeGreaterThan(-1);
    expect(billing.started).toEqual([{ plan: PLAN, binding: { platform: "ios", appAccountToken: "token-of-signed-in-user" } }]);
    expect(controller.snapshot().phase).toBe("purchasing");
  });

  it("never opens the sheet when the server will not issue a binding (a purchase it would later refuse)", async () => {
    api.bindingError = server(409, "subscription_already_active");
    await controller.buy(PLAN);
    expect(billing.started).toEqual([]);
    expect(controller.snapshot().message).toMatch(/already have an active App Subscription/);
  });

  it.each(["iap_disabled", "not_configured", "other_store_active"])("tells the member plainly when the server answers %s, and opens nothing", async (code) => {
    api.bindingError = server(code === "other_store_active" ? 409 : 503, code);
    await controller.buy(PLAN);
    expect(billing.started).toEqual([]);
    expect(controller.snapshot().phase).toBe("failed");
    expect(controller.snapshot().message).toBeTruthy();
  });

  it("ignores a second tap while a purchase is in progress", async () => {
    await controller.buy(PLAN);
    await controller.buy(PLAN);
    expect(billing.started).toHaveLength(1);
  });

  it("uses the Android binding on Android", async () => {
    billing = new FakeBilling();
    billing.platform = "android";
    api.bindingFor = { platform: "android", obfuscatedAccountId: "hash-of-signed-in-user" };
    controller = new BillingController({ billing, api });
    await controller.load();
    await controller.buy({ ...PLAN, productId: "play_sub", basePlanId: "monthly", offerToken: "offer-1" });
    expect(api.order).toEqual(["binding:android"]);
    expect(billing.started[0].binding).toEqual({ platform: "android", obfuscatedAccountId: "hash-of-signed-in-user" });
  });
});

describe("access comes only from the server's answer, and the purchase is finished only after it", () => {
  beforeEach(() => controller.load());

  it("verifies with the server, THEN finishes with the store, then reports success and re-reads access", async () => {
    await controller.buy(PLAN);
    billing.emitPurchase(proof("tx-1"));
    await controller.settled();

    expect(api.verified).toEqual(["tx-1"]);
    expect(billing.finished).toEqual(["tx-1"]);
    expect(api.order.indexOf("verify:tx-1")).toBeGreaterThan(-1);
    expect(controller.snapshot()).toMatchObject({ phase: "success", verified: VERIFIED, unsettledCount: 0 });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("does not finish, and does not grant, when the store says yes but the server says no", async () => {
    api.verifyResults = [server(409, "binding_required")];
    billing.emitPurchase(proof("tx-2"));
    await controller.settled();
    expect(billing.finished).toEqual([]);
    expect(changed).not.toHaveBeenCalled();
    expect(controller.snapshot()).toMatchObject({ phase: "failed", retryable: false });
    expect(controller.snapshot().message).toMatch(/couldn't link this purchase to your account/);
  });

  it.each(["owned_by_other", "binding_required", "product_unknown", "provider_rejected", "environment_not_accepted"])("a purchase the server refuses (%s) is never finished and never retried in a loop", async (code) => {
    api.verifyResults = [server(409, code)];
    billing.emitPurchase(proof("tx-3"));
    await controller.settled();
    await controller.retryUnsettled();
    await controller.retryUnsettled();
    expect(api.verified).toEqual(["tx-3"]); // asked once, never again
    expect(billing.finished).toEqual([]);
    expect(controller.snapshot().unsettledCount).toBe(0);
  });

  it("keeps a purchase after a transient failure (no connection, store unreachable) UNFINISHED, and finishes it once the server accepts", async () => {
    api.verifyResults = [server(0, null), VERIFIED];
    billing.emitPurchase(proof("tx-4"));
    await controller.settled();
    expect(billing.finished).toEqual([]);
    expect(controller.snapshot()).toMatchObject({ phase: "failed", retryable: true, unsettledCount: 1 });
    expect(controller.snapshot().message).toMatch(/purchase is safe|couldn't be reached|finish setting it up/i);

    await controller.retryUnsettled();
    expect(billing.finished).toEqual(["tx-4"]);
    expect(controller.snapshot()).toMatchObject({ phase: "success", unsettledCount: 0 });
  });

  it("treats the server's 'still processing' as transient too", async () => {
    api.verifyResults = [server(409, "purchase_pending"), VERIFIED];
    billing.emitPurchase(proof("tx-5"));
    await controller.settled();
    expect(controller.snapshot().unsettledCount).toBe(1);
    await controller.retryUnsettled();
    expect(billing.finished).toEqual(["tx-5"]);
  });

  it("the same transaction delivered twice at once is verified once", async () => {
    billing.emitPurchase(proof("tx-6"));
    billing.emitPurchase(proof("tx-6"));
    await controller.settled();
    expect(api.verified).toEqual(["tx-6"]);
    expect(billing.finished).toEqual(["tx-6"]);
  });

  it("'already active on this account' is success for a duplicate delivery: it is finished and the member is told", async () => {
    api.verifyResults = [server(409, "subscription_already_active")];
    billing.emitPurchase(proof("tx-7"));
    await controller.settled();
    expect(billing.finished).toEqual(["tx-7"]);
    expect(changed).toHaveBeenCalled();
  });

  it("a finish that fails does not undo the server's acceptance", async () => {
    billing.finishError = new Error("store hiccup");
    billing.emitPurchase(proof("tx-8"));
    await controller.settled();
    expect(controller.snapshot().phase).toBe("success");
    expect(changed).toHaveBeenCalled();
  });
});

describe("what the store reports before a purchase completes", () => {
  beforeEach(() => controller.load());

  it("a cancelled purchase returns to ready with no scolding", async () => {
    await controller.buy(PLAN);
    billing.emitError(new BillingError("cancelled"));
    expect(controller.snapshot()).toMatchObject({ phase: "ready", message: null });
  });

  it("a purchase the store is holding (Ask to Buy, slow payment) shows as pending, then completes through the listener", async () => {
    await controller.buy(PLAN);
    billing.emitError(new BillingError("pending"));
    expect(controller.snapshot().phase).toBe("pending");
    billing.emitPurchase(proof("tx-9"));
    await controller.settled();
    expect(controller.snapshot().phase).toBe("success");
  });

  it("a store error before any charge says nothing was charged and can be retried", async () => {
    billing.startError = new BillingError("network");
    await controller.buy(PLAN);
    expect(controller.snapshot()).toMatchObject({ phase: "failed", retryable: true });
    expect(controller.snapshot().message).toMatch(/haven't been charged/);
  });

  it("'already owned' points to Restore instead of buying again", async () => {
    await controller.buy(PLAN);
    billing.emitError(new BillingError("already_owned"));
    expect(controller.snapshot().message).toMatch(/Restore purchases/);
  });
});

describe("restore", () => {
  beforeEach(() => controller.load());

  it("says so plainly when the store holds nothing", async () => {
    await controller.restore();
    expect(controller.snapshot().restoreMessage).toBe("No App Subscription purchases were found for this store account.");
    expect(api.verified).toEqual([]);
  });

  it("offers each purchase to the server and reports the restore, finishing what the server accepts", async () => {
    billing.owned = [proof("own-1")];
    await controller.restore();
    expect(api.verified).toEqual(["own-1"]);
    expect(billing.finished).toEqual(["own-1"]);
    expect(controller.snapshot().restoreMessage).toBe("Your App Subscription has been restored.");
    expect(controller.snapshot().verified).toEqual(VERIFIED);
  });

  it("tells the member honestly when the purchase belongs to ANOTHER S&C account, and changes nothing", async () => {
    billing.owned = [proof("own-2")];
    api.verifyResults = [server(409, "owned_by_other")];
    await controller.restore();
    expect(controller.snapshot().restoreMessage).toMatch(/different S&C account/);
    expect(billing.finished).toEqual([]);
    expect(changed).not.toHaveBeenCalled();
  });

  it("separates 'the server could not be reached' from 'nothing found'", async () => {
    billing.owned = [proof("own-3")];
    api.verifyResults = [server(0, null)];
    await controller.restore();
    expect(controller.snapshot()).toMatchObject({ retryable: true });
    expect(controller.snapshot().restoreMessage).toMatch(/couldn't reach the server/);
  });

  it("survives the store failing to answer", async () => {
    billing.getOwned = async () => {
      throw new Error("store down");
    };
    await controller.restore();
    expect(controller.snapshot()).toMatchObject({ retryable: true });
  });
});

describe("quiet recovery at launch", () => {
  it("offers a paid-but-undelivered purchase to the server once, silently, when the member has no digital access", async () => {
    billing.owned = [proof("lost-1")];
    await controller.recover(false);
    await controller.settled();
    expect(api.verified).toEqual(["lost-1"]);
    expect(billing.finished).toEqual(["lost-1"]);
    expect(controller.snapshot().phase).toBe("idle"); // nothing drawn
    expect(changed).toHaveBeenCalled();
  });

  it("does nothing when the member already has digital access, and only once per session", async () => {
    billing.owned = [proof("lost-2")];
    await controller.recover(true);
    expect(billing.log).not.toContain("getOwned");
    await controller.recover(false);
    await controller.recover(false);
    expect(billing.log.filter((l) => l === "getOwned")).toHaveLength(1);
  });

  it("never shows or retries a refusal (a different store account on the same phone)", async () => {
    billing.owned = [proof("lost-3")];
    api.verifyResults = [server(409, "owned_by_other")];
    await controller.recover(false);
    await controller.settled();
    expect(controller.snapshot()).toMatchObject({ phase: "idle", message: null });
    expect(billing.finished).toEqual([]);
  });

  it("gives up silently when billing cannot connect or the store errors", async () => {
    billing.connectResult = false;
    await expect(controller.recover(false)).resolves.toBeUndefined();
    expect(api.verified).toEqual([]);
  });
});

describe("leaving the paywall", () => {
  it("still settles a purchase that arrives afterwards, but no longer drives a screen", async () => {
    await controller.load();
    controller.leave();
    billing.emitPurchase(proof("late-1"));
    await controller.settled();
    expect(api.verified).toEqual(["late-1"]);
    expect(billing.finished).toEqual(["late-1"]);
    expect(changed).toHaveBeenCalled();
    expect(controller.snapshot().phase).toBe("ready");
  });

  it("dispose removes every listener and disconnects", async () => {
    await controller.load();
    expect(billing.listenerCount).toBe(2);
    await controller.dispose();
    expect(billing.listenerCount).toBe(0);
    expect(billing.log).toContain("disconnect");
  });
});
