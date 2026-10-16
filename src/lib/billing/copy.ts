// Every sentence the purchase flow shows, in one tested place: the server's refusal codes in plain words, and the subscription disclosures the
// stores require next to the price. Plain TypeScript, no React Native imports.

import type { StorePlatform } from "./types";

// ── The server's stable codes, as a member should read them ──────────────────────────────────────────────

const SERVER_CODE_COPY: Record<string, string> = {
  iap_disabled: "Subscriptions aren't available right now. You haven't been charged. Please try again later.",
  not_configured: "Subscriptions aren't available right now. You haven't been charged. Please try again later.",
  binding_unavailable: "Subscriptions aren't available right now. You haven't been charged. Please try again later.",
  owned_by_other: "This subscription is already linked to a different S&C account. Sign in to the account you bought it with.",
  binding_required: "We couldn't link this purchase to your account. If you were charged, contact support and we'll put it right.",
  provider_unavailable: "The store couldn't be reached. Your purchase is safe: we'll finish setting it up when you reopen the app, or you can tap Restore purchases.",
  provider_rejected: "We couldn't verify this purchase. If you were charged, contact support.",
  product_unknown: "We couldn't match this purchase to the App Subscription. If you were charged, contact support.",
  purchase_pending: "Your purchase is still being processed by the store. We'll turn on your access as soon as it completes.",
  subscription_already_active: "You already have an active App Subscription on this account. Manage it in your store's subscription settings.",
  other_store_active: "Your App Subscription is already active through a different app store. Manage or cancel it there; you can subscribe here once it has ended.",
  environment_not_accepted: "This purchase can't be used with this version of the app.",
  invalid_request: "We couldn't read this purchase. Please try again.",
};

const GENERIC_FAILURE = "Something went wrong with your purchase. If you were charged, contact support and we'll put it right.";

export function messageForServerCode(code: string | null | undefined): string {
  return (code && SERVER_CODE_COPY[code]) || GENERIC_FAILURE;
}

/** Codes where the same purchase may succeed if tried again (nothing about the purchase itself is wrong). */
const RETRYABLE_CODES = new Set(["provider_unavailable", "purchase_pending"]);

export function isRetryableServerCode(code: string | null | undefined, status: number): boolean {
  if (status === 0) return true; // no connection
  return !!code && RETRYABLE_CODES.has(code);
}

/**
 * Codes that mean "this account can already be considered done": not an error to scold the member about when they only pressed Restore.
 */
export function isAlreadyActiveCode(code: string | null | undefined): boolean {
  return code === "subscription_already_active";
}

// ── Periods ─────────────────────────────────────────────────────────────────────────────────────────

export function periodLabel(unit: "month" | "year" | null, count: number | null): string {
  if (!unit || !count || count < 1) return "";
  if (count === 1) return unit === "month" ? "per month" : "per year";
  return unit === "month" ? `every ${count} months` : `every ${count} years`;
}

// ── Disclosures required next to a subscription price (Apple 3.1.2, Google Play subscriptions policy) ──────────────────

export function autoRenewDisclosure(platform: StorePlatform): string {
  return platform === "ios"
    ? "Payment is charged to your Apple Account when you confirm the purchase. The subscription renews automatically at the price shown unless you cancel at least 24 hours before the end of the current period. You can manage or cancel it at any time in your Apple Account settings."
    : "Payment is charged to your Google Play account when you confirm the purchase. The subscription renews automatically at the price shown unless you cancel before the renewal date. You can manage or cancel it at any time in Google Play, under Payments and subscriptions.";
}

export function manageSubscriptionLabel(platform: StorePlatform): string {
  return platform === "ios" ? "Manage in Apple Account settings" : "Manage in Google Play";
}

export const RESTORE_LABEL = "Restore purchases";

/** What the digital plan includes, in the words the paywall uses. Mirrors the features gated in src/lib/member-access.ts. */
export const DIGITAL_PLAN_FEATURES: readonly string[] = [
  "AI coach and AI nutrition coach chat",
  "Programme generation and workout reviews",
  "Food search and unlimited saved foods",
  "Tracker import, gym profiles and reminders",
];

/** A gym Membership is a separate product. This sentence appears on the paywall so nobody is surprised either way. */
export const SEPARATE_FROM_MEMBERSHIP =
  "The App Subscription is separate from a gym Membership. A gym Membership doesn't include it, and it doesn't include a gym Membership.";

export function describePlanEnd(plan: { currentPeriodEnd: string | null; autoRenewing: boolean; status: string; source: string }, format: (iso: string) => string): string {
  if (plan.source === "staff_grant") {
    return plan.currentPeriodEnd ? `Included at no charge until ${format(plan.currentPeriodEnd)}.` : "Included at no charge.";
  }
  if (plan.status === "in_grace_period") return "The store couldn't take your last payment. Access continues while it retries; update your payment method in the store.";
  if (!plan.currentPeriodEnd) return "";
  return plan.autoRenewing ? `Renews on ${format(plan.currentPeriodEnd)}.` : `Won't renew. Access continues until ${format(plan.currentPeriodEnd)}.`;
}
