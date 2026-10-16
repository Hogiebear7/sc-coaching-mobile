// Matches the SERVER's catalog (store product ids, no prices) with what the STORE actually returned, producing the plans the paywall shows. Pure.
//
// The price on screen is always the store's own string. A catalog plan the store does not return is simply not offered: the app never shows a price for
// something it cannot actually sell.

import { periodLabel, trialLabel, type TrialPeriod } from "./copy";
import type { CatalogPlan, StorePlan, StorePlatform } from "./types";

export interface RawStoreOffer {
  basePlanId: string | null;
  offerToken: string | null;
  /** Google Play offers that carry an offer id are promotional (trial, intro price); the base plan offer has none. */
  isBasePlanOffer: boolean;
  /** The FULL recurring price (what is charged after any trial), as the store formats it. */
  displayPrice: string;
  /** A free-trial phase at the start of this offer. Play only returns offers the member is eligible for. */
  freeTrial?: TrialPeriod | null;
}

export interface RawStoreProduct {
  id: string;
  title: string;
  displayPrice: string;
  /** Android only. */
  offers?: RawStoreOffer[];
  /** iOS only: a free trial the member is ELIGIBLE for (the adapter has already asked the store). Null or absent means none. */
  freeTrial?: TrialPeriod | null;
}

const FALLBACK_TITLE = "App Subscription";

export function matchStorePlans(platform: StorePlatform, catalog: CatalogPlan[], products: RawStoreProduct[]): StorePlan[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const plans: StorePlan[] = [];

  for (const entry of catalog) {
    const productId = platform === "ios" ? entry.appStoreProductId : entry.googlePlayProductId;
    if (!productId) continue;
    const product = byId.get(productId);
    if (!product) continue;

    let displayPrice = product.displayPrice;
    let offerToken: string | null = null;
    let basePlanId: string | null = null;
    // A trial is only promised when the SERVER also says it can honour one (its shared trial pool has room). Unknown (an older server) is "no".
    const trialPromised = entry.trialAvailable === true;
    let trial: TrialPeriod | null = platform === "ios" && trialPromised ? product.freeTrial ?? null : null;
    // The store would give this member a trial the server cannot honour: blocked, not promoted and not silently converted into a paid purchase.
    let trialBlocked = platform === "ios" && !trialPromised && !!product.freeTrial;

    if (platform === "android") {
      // One Play product carries several base plans (monthly, 6 months, yearly). Take THIS entry's base plan, and its regular (non-promotional) offer.
      const forBasePlan = (product.offers ?? []).filter((o) => o.basePlanId === entry.googlePlayBasePlanId);
      // A free-trial offer the store returned for this base plan means the member is eligible (Play withholds offers they are not eligible for), and
      // buying with ITS token is what starts the trial. Otherwise the regular base-plan offer: the normal paid purchase.
      // The trial offer is only chosen while the server says it can honour one; otherwise the regular base-plan offer is bought and no trial starts.
      const offer = (trialPromised ? forBasePlan.find((o) => o.freeTrial && o.offerToken) : undefined) ?? forBasePlan.find((o) => o.isBasePlanOffer) ?? forBasePlan[0];
      if (!offer || !offer.offerToken) continue; // cannot be purchased without an offer token
      displayPrice = offer.displayPrice || product.displayPrice;
      offerToken = offer.offerToken;
      basePlanId = entry.googlePlayBasePlanId;
      trial = trialPromised ? offer.freeTrial ?? null : null;
      trialBlocked = !trialPromised && forBasePlan.some((o) => o.freeTrial && o.offerToken);
    }

    if (!displayPrice) continue; // never show a plan without the store's price

    plans.push({
      billingOptionId: entry.billingOptionId,
      productId,
      title: product.title?.trim() || FALLBACK_TITLE,
      displayPrice,
      periodLabel: periodLabel(entry.intervalUnit, entry.intervalCount),
      intervalUnit: entry.intervalUnit,
      intervalCount: entry.intervalCount,
      basePlanId,
      offerToken,
      trial: trial ? { label: trialLabel(trial) } : null,
      trialBlocked,
    });
  }

  // Shortest period first, so the list reads monthly, 6 months, yearly.
  const months = (p: StorePlan) => (p.intervalUnit === "year" ? 12 : 1) * (p.intervalCount ?? 1);
  return plans.sort((a, b) => months(a) - months(b));
}
