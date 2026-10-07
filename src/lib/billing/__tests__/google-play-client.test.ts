// The expo-iap adapter (src/lib/billing/google-play-client.ts) against a FAKE native module. No device, no network, no
// real token. This proves the adapter's own logic (binding passed before purchase, offer selection, event handling,
// restore, finish). It does NOT prove expo-iap behaves as written: that needs the Play internal test track.
import { describe, expect, it, vi } from "vitest";

import { createGooglePlayClient, type ExpoIapLike } from "../google-play-client";

const PRODUCT = "app_subscription";
const BINDING = "binding-from-server-0123456789abcdef";

type Listener = (value: unknown) => void;

function fakeModule(over: Partial<ExpoIapLike> = {}) {
  const updated: Listener[] = [];
  const errored: Listener[] = [];
  const removed = { updates: 0, errors: 0 };
  const requests: unknown[] = [];
  const mod: ExpoIapLike = {
    initConnection: vi.fn(async () => true),
    endConnection: vi.fn(async () => true),
    fetchProducts: vi.fn(async () => [
      {
        id: PRODUCT,
        subscriptionOffers: [
          { basePlanIdAndroid: "monthly", offerTokenAndroid: "offer-monthly" },
          { basePlanIdAndroid: "annual", offerTokenAndroid: "offer-annual" },
        ],
      },
    ]),
    requestPurchase: vi.fn(async (args) => {
      requests.push(args);
      return null;
    }),
    purchaseUpdatedListener: (l) => {
      updated.push(l);
      return { remove: () => void removed.updates++ };
    },
    purchaseErrorListener: (l) => {
      errored.push(l);
      return { remove: () => void removed.errors++ };
    },
    getAvailablePurchases: vi.fn(async () => []),
    finishTransaction: vi.fn(async () => undefined),
    ...over,
  };
  return { mod, updated, errored, removed, requests };
}

const clientFor = (mod: ExpoIapLike | null, platform = "android", launchTimeoutMs = 1000) => createGooglePlayClient({ loadModule: () => mod, platform, launchTimeoutMs });
const launchArgs = { productId: PRODUCT, basePlanId: "monthly", obfuscatedAccountId: BINDING };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("availability", () => {
  it("is unavailable off Android and when the native module is missing", () => {
    expect(clientFor(fakeModule().mod, "ios").isAvailable()).toBe(false);
    expect(clientFor(fakeModule().mod, "web").isAvailable()).toBe(false);
    expect(clientFor(null).isAvailable()).toBe(false);
    expect(clientFor(fakeModule().mod).isAvailable()).toBe(true);
  });

  it("connect throws when unavailable, and launch reports an error instead of crashing", async () => {
    const c = clientFor(null);
    await expect(c.connect()).rejects.toThrow();
    expect(await c.launchSubscription(launchArgs)).toEqual({ kind: "error", code: "billing_unavailable" });
    expect(await c.getOwnedPurchases()).toEqual([]);
  });
});

describe("launchSubscription", () => {
  it("passes the server's binding UNCHANGED, with the chosen base plan's offer token, before the purchase starts", async () => {
    const { mod, updated, requests } = fakeModule();
    const pending = clientFor(mod).launchSubscription({ ...launchArgs, basePlanId: "annual" });
    await tick();
    expect(requests).toEqual([
      { type: "subs", request: { google: { skus: [PRODUCT], obfuscatedAccountId: BINDING, subscriptionOffers: [{ sku: PRODUCT, offerToken: "offer-annual" }] } } },
    ]);
    updated[0]({ productId: PRODUCT, purchaseToken: "fake-token", purchaseState: "purchased" });
    expect(await pending).toEqual({ kind: "purchased", purchaseToken: "fake-token", productId: PRODUCT });
  });

  it("reports a pending purchase without a token", async () => {
    const { mod, updated } = fakeModule();
    const pending = clientFor(mod).launchSubscription(launchArgs);
    await tick();
    updated[0]({ productId: PRODUCT, purchaseToken: "fake-token", purchaseState: "pending" });
    expect(await pending).toEqual({ kind: "pending" });
  });

  it("ignores update events for other products", async () => {
    const { mod, updated } = fakeModule();
    const pending = clientFor(mod).launchSubscription(launchArgs);
    await tick();
    updated[0]({ productId: "unrelated", purchaseToken: "stray", purchaseState: "purchased" });
    updated[0]({ productId: PRODUCT, purchaseToken: "fake-token", purchaseState: "purchased" });
    expect(await pending).toMatchObject({ kind: "purchased", purchaseToken: "fake-token" });
  });

  it.each([
    ["user-cancelled", { kind: "cancelled" }],
    ["already-owned", { kind: "already_owned" }],
    ["pending", { kind: "pending" }],
    ["network-error", { kind: "error", code: "network-error" }],
  ])("maps the store error %s", async (code, expected) => {
    const { mod, errored } = fakeModule();
    const pending = clientFor(mod).launchSubscription(launchArgs);
    await tick();
    errored[0]({ code, message: "x" });
    expect(await pending).toEqual(expected);
  });

  it("maps a rejected requestPurchase the same way", async () => {
    const { mod } = fakeModule({ requestPurchase: vi.fn(async () => Promise.reject({ code: "user-cancelled" })) });
    expect(await clientFor(mod).launchSubscription(launchArgs)).toEqual({ kind: "cancelled" });
  });

  it("removes its listeners once settled, and settles only once", async () => {
    const { mod, updated, errored, removed } = fakeModule();
    const pending = clientFor(mod).launchSubscription(launchArgs);
    await tick();
    updated[0]({ productId: PRODUCT, purchaseToken: "t1", purchaseState: "purchased" });
    errored[0]({ code: "user-cancelled" });
    expect(await pending).toMatchObject({ kind: "purchased", purchaseToken: "t1" });
    expect(removed).toEqual({ updates: 1, errors: 1 });
  });

  it("times out instead of hanging forever", async () => {
    const { mod } = fakeModule();
    expect(await clientFor(mod, "android", 20).launchSubscription(launchArgs)).toEqual({ kind: "error", code: "timeout" });
  });

  it("refuses to launch when the store lists no offer for the base plan, and never starts a purchase", async () => {
    const { mod, requests } = fakeModule();
    expect(await clientFor(mod).launchSubscription({ ...launchArgs, basePlanId: "weekly" })).toEqual({ kind: "error", code: "offer_not_found" });
    expect(requests).toEqual([]);
  });

  it("reports a product lookup failure without starting a purchase", async () => {
    const { mod, requests } = fakeModule({ fetchProducts: vi.fn(async () => Promise.reject(new Error("boom"))) });
    expect(await clientFor(mod).launchSubscription(launchArgs)).toEqual({ kind: "error", code: "fetch_products_failed" });
    expect(requests).toEqual([]);
  });
});

describe("getOwnedPurchases and finishVerified", () => {
  it("lists settled purchases with a token and skips pending ones", async () => {
    const { mod } = fakeModule({
      getAvailablePurchases: vi.fn(async () => [
        { productId: PRODUCT, purchaseToken: "t1", purchaseState: "purchased" },
        { productId: PRODUCT, purchaseToken: "t2", purchaseState: "pending" },
        { productId: PRODUCT, purchaseToken: null, purchaseState: "purchased" },
      ]),
    });
    expect(await clientFor(mod).getOwnedPurchases()).toEqual([{ purchaseToken: "t1", productId: PRODUCT }]);
  });

  it("finishes the matching purchase as a non-consumable subscription, and ignores an unknown token", async () => {
    const owned = { productId: PRODUCT, purchaseToken: "t1", purchaseState: "purchased" };
    const { mod } = fakeModule({ getAvailablePurchases: vi.fn(async () => [owned]) });
    const c = clientFor(mod);
    await c.finishVerified("t1");
    expect(mod.finishTransaction).toHaveBeenCalledWith({ purchase: owned, isConsumable: false });
    await c.finishVerified("nope");
    expect(mod.finishTransaction).toHaveBeenCalledTimes(1);
  });
});
