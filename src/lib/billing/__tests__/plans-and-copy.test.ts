import { describe, expect, it } from "vitest";

import {
  autoRenewDisclosure,
  describePlanEnd,
  DIGITAL_PLAN_FEATURES,
  isAlreadyActiveCode,
  isRetryableServerCode,
  manageSubscriptionLabel,
  messageForServerCode,
  parseIsoPeriod,
  periodLabel,
  SEPARATE_FROM_MEMBERSHIP,
  trialHeadline,
  trialLabel,
  TRIAL_AI_UNAVAILABLE_NOTE,
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

  it("says AI use has a limit, and never advertises unlimited AI anywhere in the purchase copy", async () => {
    const copy = await import("@/lib/billing/copy");
    expect(copy.AI_ALLOWANCE_NOTE).toMatch(/allowance/);
    // What is limited, when it resets, what happens at the limit, and that it is not the subscription.
    expect(copy.AI_ALLOWANCE_NOTE).toMatch(/AI features/);
    expect(copy.AI_ALLOWANCE_NOTE).toMatch(/rolling 30 days/);
    expect(copy.AI_ALLOWANCE_NOTE).toMatch(/whole trial/);
    expect(copy.AI_ALLOWANCE_NOTE).toMatch(/only the AI features pause/);
    expect(copy.AI_ALLOWANCE_NOTE).toMatch(/subscription .* unaffected/);
    expect(copy.AI_ALLOWANCE_NOTE).not.toMatch(/fair.use/i);
    expect(copy.AI_ALLOWANCE_REACHED_CODE).toBe("ai_allowance_reached");
    const everything = [copy.AI_ALLOWANCE_NOTE, ...copy.DIGITAL_PLAN_FEATURES, copy.SEPARATE_FROM_MEMBERSHIP, copy.autoRenewDisclosure("ios", { trial: true })].join(" ");
    expect(everything).not.toMatch(/unlimited AI|unlimited chat|unlimited coaching/i);
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

describe("free trial display: only what the store says this member is eligible for, with the full price after it", () => {
  const catalog: CatalogPlan[] = [
    { billingOptionId: "m", intervalUnit: "month", intervalCount: 1, appStoreProductId: "apple.monthly", googlePlayProductId: "play_sub", googlePlayBasePlanId: "monthly", trialAvailable: true },
    { billingOptionId: "y", intervalUnit: "year", intervalCount: 1, appStoreProductId: "apple.annual", googlePlayProductId: "play_sub", googlePlayBasePlanId: "annual", trialAvailable: true },
  ];

  it("iOS: an eligible member sees the trial length the store returned, and the plan's full price", () => {
    const plans = matchStorePlans("ios", catalog, [
      { id: "apple.monthly", title: "S&C", displayPrice: "€12.99", freeTrial: { unit: "day", count: 7 } },
      { id: "apple.annual", title: "S&C", displayPrice: "€84.00", freeTrial: { unit: "day", count: 7 } },
    ]);
    expect(plans.map((p) => [p.billingOptionId, p.displayPrice, p.trial?.label])).toEqual([["m", "€12.99", "7 days"], ["y", "€84.00", "7 days"]]);
  });

  it("iOS: an ineligible (or unknown) member sees the normal paid offer, no trial", () => {
    const plans = matchStorePlans("ios", catalog, [{ id: "apple.monthly", title: "S&C", displayPrice: "€12.99", freeTrial: null }, { id: "apple.annual", title: "S&C", displayPrice: "€84.00" }]);
    expect(plans.map((p) => p.trial)).toEqual([null, null]);
  });

  it("the trial length is whatever the store returned: it is never assumed to be seven days", () => {
    const plans = matchStorePlans("ios", catalog, [{ id: "apple.monthly", title: "S&C", displayPrice: "€12.99", freeTrial: { unit: "day", count: 3 } }]);
    expect(plans[0].trial?.label).toBe("3 days");
    expect(trialLabel({ unit: "week", count: 1 })).toBe("1 week");
    expect(trialLabel({ unit: "month", count: 1 })).toBe("1 month");
  });

  it("Android: a trial offer the store returned for the base plan is chosen WITH ITS OWN token, priced at the full recurring price", () => {
    const products: RawStoreProduct[] = [
      {
        id: "play_sub",
        title: "S&C",
        displayPrice: "€12.99",
        offers: [
          { basePlanId: "monthly", offerToken: "tok-base", isBasePlanOffer: true, displayPrice: "€12.99" },
          { basePlanId: "monthly", offerToken: "tok-trial", isBasePlanOffer: false, displayPrice: "€12.99", freeTrial: { unit: "day", count: 7 } },
          { basePlanId: "annual", offerToken: "tok-annual", isBasePlanOffer: true, displayPrice: "€84.00" },
        ],
      },
    ];
    const plans = matchStorePlans("android", catalog, products);
    const monthly = plans.find((p) => p.billingOptionId === "m")!;
    expect(monthly).toMatchObject({ offerToken: "tok-trial", displayPrice: "€12.99", trial: { label: "7 days" } });
    const annual = plans.find((p) => p.billingOptionId === "y")!;
    expect(annual).toMatchObject({ offerToken: "tok-annual", trial: null }); // no trial offer returned for this plan: the normal paid purchase
  });

  it("Android: when the store returns no trial offer (already used, ineligible) the member gets the regular base-plan offer", () => {
    const plans = matchStorePlans("android", catalog, [{ id: "play_sub", title: "S&C", displayPrice: "€12.99", offers: [{ basePlanId: "monthly", offerToken: "tok-base", isBasePlanOffer: true, displayPrice: "€12.99" }] }]);
    expect(plans[0]).toMatchObject({ offerToken: "tok-base", trial: null });
  });

  describe("when the server cannot honour a trial's AI (shared trial pool unavailable), or does not say", () => {
    const unavailable = catalog.map((c) => ({ ...c, trialAvailable: false }));
    const unknown = catalog.map(({ trialAvailable: _omit, ...c }) => c as CatalogPlan);
    const iosProducts = [
      { id: "apple.monthly", title: "S&C", displayPrice: "€12.99", freeTrial: { unit: "day" as const, count: 7 } },
      { id: "apple.annual", title: "S&C", displayPrice: "€84.00", freeTrial: { unit: "day" as const, count: 7 } },
    ];
    const androidProducts: RawStoreProduct[] = [
      {
        id: "play_sub",
        title: "S&C",
        displayPrice: "€12.99",
        offers: [
          { basePlanId: "monthly", offerToken: "tok-base", isBasePlanOffer: true, displayPrice: "€12.99" },
          { basePlanId: "monthly", offerToken: "tok-trial", isBasePlanOffer: false, displayPrice: "€12.99", freeTrial: { unit: "day", count: 7 } },
        ],
      },
    ];

    it("iOS: the app does not promote a trial, and says AI is not available during the one the store may still apply", () => {
      for (const c of [unavailable, unknown]) {
        const plans = matchStorePlans("ios", c, iosProducts);
        expect(plans.map((p) => p.trial)).toEqual([null, null]);
        expect(plans.every((p) => p.trialAiUnavailable === true)).toBe(true);
      }
    });

    it("Android: the plan is bought with the REGULAR base-plan offer (no trial token), so no trial starts and nothing is promised", () => {
      for (const c of [unavailable, unknown]) {
        const monthly = matchStorePlans("android", c, androidProducts).find((p) => p.billingOptionId === "m")!;
        expect(monthly).toMatchObject({ offerToken: "tok-base", trial: null, trialAiUnavailable: false });
      }
    });

    it("no trial offered by the store at all: nothing to warn about", () => {
      const plans = matchStorePlans("ios", unavailable, [{ id: "apple.monthly", title: "S&C", displayPrice: "€12.99", freeTrial: null }]);
      expect(plans[0]).toMatchObject({ trial: null, trialAiUnavailable: false });
    });

    it("the note never promotes the trial and keeps the rest of the app in view", () => {
      expect(TRIAL_AI_UNAVAILABLE_NOTE).toMatch(/AI features aren't available during a trial right now/);
      expect(TRIAL_AI_UNAVAILABLE_NOTE).toMatch(/Everything else in the app works/);
      expect(TRIAL_AI_UNAVAILABLE_NOTE).not.toMatch(/start your|try .* free|free for/i);
    });
  });

  it("parses Play's billing period for a trial phase, and trusts nothing unfamiliar", () => {
    expect(parseIsoPeriod("P7D")).toEqual({ unit: "day", count: 7 });
    expect(parseIsoPeriod("P1W")).toEqual({ unit: "week", count: 1 });
    expect(parseIsoPeriod("P1M")).toEqual({ unit: "month", count: 1 });
    for (const bad of ["P0D", "7D", "PT1H", "P1Y2M", "", null, undefined, "P-1D"]) expect(parseIsoPeriod(bad as never)).toBeNull();
  });

  it("the headline states the trial, then the FULL price and period, from the store's strings", () => {
    expect(trialHeadline("7 days", "€12.99", "per month")).toBe("7 days free, then €12.99 per month");
    expect(trialHeadline("7 days", "€84.00", "per year")).toBe("7 days free, then €84.00 per year");
  });

  it("the trial disclosure says it converts to paid, when to cancel, and where to manage it, per store", () => {
    const ios = autoRenewDisclosure("ios", { trial: true });
    expect(ios).toMatch(/free trial/i);
    expect(ios).toMatch(/at least 24 hours before it ends/);
    expect(ios).toMatch(/charged the price shown/);
    expect(ios).toMatch(/Apple Account settings/);
    const android = autoRenewDisclosure("android", { trial: true });
    expect(android).toMatch(/cancel before it ends/);
    expect(android).toMatch(/Google Play/);
    expect(autoRenewDisclosure("ios")).not.toMatch(/free trial/i); // the normal disclosure is unchanged for an ineligible member
  });

  it("describes a plan that is in its free trial, and one that was cancelled during it", () => {
    const fmt = (iso: string) => iso.slice(0, 10);
    expect(describePlanEnd({ source: "app_store", status: "active", autoRenewing: true, trial: true, currentPeriodEnd: "2026-12-08T00:00:00Z" }, fmt)).toBe("Free trial until 2026-12-08, then it renews at the store price unless you cancel before then.");
    expect(describePlanEnd({ source: "app_store", status: "canceled", autoRenewing: false, trial: true, currentPeriodEnd: "2026-12-08T00:00:00Z" }, fmt)).toBe("Free trial. It won't renew, and access continues until 2026-12-08.");
    expect(describePlanEnd({ source: "app_store", status: "active", autoRenewing: true, trial: false, currentPeriodEnd: "2026-12-08T00:00:00Z" }, fmt)).toBe("Renews on 2026-12-08.");
  });
});
