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

// ── Free trial ──────────────────────────────────────────────────────────────────────────────────────

export interface TrialPeriod {
  unit: "day" | "week" | "month" | "year";
  count: number;
}

/** "7 days", "1 week", "1 month": exactly the length the store returned. */
export function trialLabel(period: TrialPeriod): string {
  return `${period.count} ${period.unit}${period.count === 1 ? "" : "s"}`;
}

/** Parses the ISO-8601 billing period Google Play reports for a trial phase ("P7D", "P1W", "P1M", "P1Y"). Anything else is not trusted: null. */
export function parseIsoPeriod(iso: string | null | undefined): TrialPeriod | null {
  const m = /^P(\d+)([DWMY])$/.exec(iso ?? "");
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isInteger(count) || count < 1) return null;
  return { count, unit: ({ D: "day", W: "week", M: "month", Y: "year" } as const)[m[2] as "D" | "W" | "M" | "Y"] };
}

// ── Disclosures required next to a subscription price (Apple 3.1.2, Google Play subscriptions policy) ──────────────────

/** The headline under a plan that has an eligible free trial: the trial length, then the FULL price and period. All three are the store's own values. */
export function trialHeadline(trialText: string, displayPrice: string, period: string): string {
  return `${trialText} free, then ${displayPrice} ${period}`.trim();
}

export function autoRenewDisclosure(platform: StorePlatform, options: { trial?: boolean } = {}): string {
  if (options.trial) {
    return platform === "ios"
      ? "Your free trial starts when you confirm. Unless you cancel at least 24 hours before it ends, it converts to a paid subscription and your Apple Account is charged the price shown, and the subscription then renews automatically each period at that price. You can manage or cancel it at any time in your Apple Account settings."
      : "Your free trial starts when you confirm. Unless you cancel before it ends, it converts to a paid subscription and your Google Play account is charged the price shown, and the subscription then renews automatically each period at that price. You can manage or cancel it at any time in Google Play, under Payments and subscriptions.";
  }
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

/** AI use has a limit, and the paywall says so. Nothing in the app advertises unlimited AI. */
export const AI_ALLOWANCE_NOTE = "AI features include a fair-use allowance over a rolling 30 days.";

/** A gym Membership is a separate product. This sentence appears on the paywall so nobody is surprised either way. */
export const SEPARATE_FROM_MEMBERSHIP =
  "The App Subscription is separate from a gym Membership. A gym Membership doesn't include it, and it doesn't include a gym Membership.";

export function describePlanEnd(plan: { currentPeriodEnd: string | null; autoRenewing: boolean; status: string; source: string; trial?: boolean }, format: (iso: string) => string): string {
  if (plan.source === "staff_grant") {
    return plan.currentPeriodEnd ? `Included at no charge until ${format(plan.currentPeriodEnd)}.` : "Included at no charge.";
  }
  if (plan.status === "in_grace_period") return "The store couldn't take your last payment. Access continues while it retries; update your payment method in the store.";
  if (!plan.currentPeriodEnd) return "";
  if (plan.trial) {
    return plan.autoRenewing
      ? `Free trial until ${format(plan.currentPeriodEnd)}, then it renews at the store price unless you cancel before then.`
      : `Free trial. It won't renew, and access continues until ${format(plan.currentPeriodEnd)}.`;
  }
  return plan.autoRenewing ? `Renews on ${format(plan.currentPeriodEnd)}.` : `Won't renew. Access continues until ${format(plan.currentPeriodEnd)}.`;
}
