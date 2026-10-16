// Matches the SERVER's catalog (store product ids, no prices) with what the STORE actually returned, producing the plans the paywall shows. Pure.
//
// The price on screen is always the store's own string. A catalog plan the store does not return is simply not offered: the app never shows a price for
// something it cannot actually sell.

import { periodLabel } from "./copy";
import type { CatalogPlan, StorePlan, StorePlatform } from "./types";

export interface RawStoreOffer {
  basePlanId: string | null;
  offerToken: string | null;
  /** Google Play offers that carry an offer id are promotional (trial, intro price); the base plan offer has none. */
  isBasePlanOffer: boolean;
  displayPrice: string;
}

export interface RawStoreProduct {
  id: string;
  title: string;
  displayPrice: string;
  /** Android only. */
  offers?: RawStoreOffer[];
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

    if (platform === "android") {
      // One Play product carries several base plans (monthly, 6 months, yearly). Take THIS entry's base plan, and its regular (non-promotional) offer.
      const forBasePlan = (product.offers ?? []).filter((o) => o.basePlanId === entry.googlePlayBasePlanId);
      const offer = forBasePlan.find((o) => o.isBasePlanOffer) ?? forBasePlan[0];
      if (!offer || !offer.offerToken) continue; // cannot be purchased without an offer token
      displayPrice = offer.displayPrice || product.displayPrice;
      offerToken = offer.offerToken;
      basePlanId = entry.googlePlayBasePlanId;
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
    });
  }

  // Shortest period first, so the list reads monthly, 6 months, yearly.
  const months = (p: StorePlan) => (p.intervalUnit === "year" ? 12 : 1) * (p.intervalCount ?? 1);
  return plans.sort((a, b) => months(a) - months(b));
}
