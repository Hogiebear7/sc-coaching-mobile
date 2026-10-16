import { describe, expect, it } from "vitest";

import {
  autoRenewDisclosure,
  describePlanEnd,
  DIGITAL_PLAN_FEATURES,
  isAlreadyActiveCode,
  isRetryableServerCode,
  manageSubscriptionLabel,
  messageForServerCode,
  periodLabel,
  SEPARATE_FROM_MEMBERSHIP,
} from "@/lib/billing/copy";
import { matchStorePlans, type RawStoreProduct } from "@/lib/billing/plans";
import type { CatalogPlan } from "@/lib/billing/types";

const CATALOG: CatalogPlan[] = [
  { billingOptionId: "y", intervalUnit: "year", intervalCount: 1, appStoreProductId: "apple.annual", googlePlayProductId: "play_sub", googlePlayBasePlanId: "annual" },
  { billingOptionId: "m", intervalUnit: "month", intervalCount: 1, appStoreProductId: "apple.monthly", googlePlayProductId: "play_sub", googlePlayBasePlanId: "monthly" },
  { billingOptionId: "s", intervalUnit: "month", intervalCount: 6, appStoreProductId: "apple.semi", googlePlayProductId: "play_sub", googlePlayBasePlanId: "semiannual" },
  { billingOptionId: "unmapped", intervalUnit: "month", intervalCount: 3, appStoreProductId: null, googlePlayProductId: null, googlePlayBasePlanId: null },
];

describe("matchStorePlans: the price is the store's, and only what the store returns is offered", () => {
  it("iOS: one plan per product the store returned, with the store's own price, shortest period first", () => {
    const products: RawStoreProduct[] = [
      { id: "apple.annual", title: "Yearly", displayPrice: "€84.00" },
      { id: "apple.monthly", title: "Monthly", displayPrice: "€12.99" },
    ];
    const plans = matchStorePlans("ios", CATALOG, products);
    expect(plans.map((p) => [p.billingOptionId, p.displayPrice, p.periodLabel])).toEqual([
      ["m", "€12.99", "per month"],
      ["y", "€84.00", "per year"],
    ]);
  });

  it("never offers a plan the store did not return, and never invents a price", () => {
    expect(matchStorePlans("ios", CATALOG, [])).toEqual([]);
    expect(matchStorePlans("ios", CATALOG, [{ id: "apple.monthly", title: "x", displayPrice: "" }])).toEqual([]);
  });

  it("ignores products that are not in the catalog", () => {
    expect(matchStorePlans("ios", CATALOG, [{ id: "something.else", title: "x", displayPrice: "$1" }])).toEqual([]);
  });

  it("Android: picks each plan's own base plan from the ONE Play product, using the regular (non-promotional) offer and its token", () => {
    const products: RawStoreProduct[] = [
      {
        id: "play_sub",
        title: "App Subscription",
        displayPrice: "€12.99",
        offers: [
          { basePlanId: "monthly", offerToken: "tok-monthly-trial", isBasePlanOffer: false, displayPrice: "Free" },
          { basePlanId: "monthly", offerToken: "tok-monthly", isBasePlanOffer: true, displayPrice: "€12.99" },
          { basePlanId: "annual", offerToken: "tok-annual", isBasePlanOffer: true, displayPrice: "€84.00" },
          { basePlanId: "semiannual", offerToken: "tok-semi", isBasePlanOffer: true, displayPrice: "€53.99" },
        ],
      },
    ];
    const plans = matchStorePlans("android", CATALOG, products);
    expect(plans.map((p) => [p.billingOptionId, p.offerToken, p.displayPrice, p.basePlanId])).toEqual([
      ["m", "tok-monthly", "€12.99", "monthly"],
      ["s", "tok-semi", "€53.99", "semiannual"],
      ["y", "tok-annual", "€84.00", "annual"],
    ]);
  });

  it("Android: a base plan with no purchasable offer token is not offered", () => {
    const products: RawStoreProduct[] = [{ id: "play_sub", title: "x", displayPrice: "€1", offers: [{ basePlanId: "monthly", offerToken: null, isBasePlanOffer: true, displayPrice: "€1" }] }];
    expect(matchStorePlans("android", CATALOG, products)).toEqual([]);
  });

  it("falls back to a plain title when the store gives none", () => {
    expect(matchStorePlans("ios", CATALOG, [{ id: "apple.monthly", title: "  ", displayPrice: "$1" }])[0].title).toBe("App Subscription");
  });
});

describe("copy", () => {
  it("renders periods", () => {
    expect(periodLabel("month", 1)).toBe("per month");
    expect(periodLabel("month", 6)).toBe("every 6 months");
    expect(periodLabel("year", 1)).toBe("per year");
    expect(periodLabel(null, null)).toBe("");
  });

  it("every server code the billing routes can answer reads as plain words, never as a code or provider text", () => {
    for (const code of ["iap_disabled", "not_configured", "binding_unavailable", "owned_by_other", "binding_required", "provider_unavailable", "provider_rejected", "product_unknown", "purchase_pending", "subscription_already_active", "other_store_active", "environment_not_accepted", "invalid_request", "something_new", null]) {
      const message = messageForServerCode(code);
      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toMatch(/_|undefined|\bnull\b/);
    }
  });

  it("only transient conditions are retryable", () => {
    expect(isRetryableServerCode("provider_unavailable", 502)).toBe(true);
    expect(isRetryableServerCode("purchase_pending", 409)).toBe(true);
    expect(isRetryableServerCode(null, 0)).toBe(true);
    for (const code of ["owned_by_other", "binding_required", "product_unknown", "iap_disabled", "environment_not_accepted"]) expect(isRetryableServerCode(code, 409)).toBe(false);
    expect(isAlreadyActiveCode("subscription_already_active")).toBe(true);
    expect(isAlreadyActiveCode("owned_by_other")).toBe(false);
  });

  it("the auto-renew disclosure states renewal, the cancellation window and where to manage it, per store", () => {
    const ios = autoRenewDisclosure("ios");
    expect(ios).toMatch(/renews automatically/);
    expect(ios).toMatch(/at least 24 hours before/);
    expect(ios).toMatch(/Apple Account/);
    const android = autoRenewDisclosure("android");
    expect(android).toMatch(/renews automatically/);
    expect(android).toMatch(/cancel before the renewal date/);
    expect(android).toMatch(/Google Play/);
    expect(manageSubscriptionLabel("ios")).toMatch(/Apple/);
    expect(manageSubscriptionLabel("android")).toMatch(/Google Play/);
  });

  it("states that the plan is separate from a gym Membership and lists what it includes", () => {
    expect(SEPARATE_FROM_MEMBERSHIP).toMatch(/separate from a gym Membership/);
    expect(DIGITAL_PLAN_FEATURES.length).toBeGreaterThanOrEqual(3);
  });

  it("describes the end of a plan honestly for each state", () => {
    const fmt = (iso: string) => iso.slice(0, 10);
    expect(describePlanEnd({ source: "app_store", status: "active", autoRenewing: true, currentPeriodEnd: "2026-12-01T00:00:00Z" }, fmt)).toBe("Renews on 2026-12-01.");
    expect(describePlanEnd({ source: "app_store", status: "canceled", autoRenewing: false, currentPeriodEnd: "2026-12-01T00:00:00Z" }, fmt)).toBe("Won't renew. Access continues until 2026-12-01.");
    expect(describePlanEnd({ source: "google_play", status: "in_grace_period", autoRenewing: true, currentPeriodEnd: "2026-12-01T00:00:00Z" }, fmt)).toMatch(/couldn't take your last payment/);
    expect(describePlanEnd({ source: "staff_grant", status: "active", autoRenewing: false, currentPeriodEnd: null }, fmt)).toBe("Included at no charge.");
    expect(describePlanEnd({ source: "staff_grant", status: "active", autoRenewing: false, currentPeriodEnd: "2026-12-01T00:00:00Z" }, fmt)).toBe("Included at no charge until 2026-12-01.");
  });
});
