// What the onboarding screen may say about the free trial. Pure and React-free so it runs under vitest.
//
// The rule: promise a trial ONLY when the store itself has said this member is eligible for one right now (BillingSnapshot plans carry `trial` only then; see
// src/lib/billing/plans.ts). Every word about the trial's length, price and period is the store's own string. When the store has not answered, could not say,
// or reports no trial (already used, ineligible), the answer is "skip": the onboarding screen shows nothing and the member carries on in the Free tier.
// Nothing here buys anything: the trial begins only when the store confirms a trial subscription and the server accepts it (src/lib/billing/controller.ts).
import { trialHeadline } from "./copy";
import type { BillingSnapshot } from "./controller";

export interface TrialOfferPlanLine {
  billingOptionId: string;
  title: string;
  /** e.g. "7 days free, then €12.99 per month", all three values the store's. */
  line: string;
}

export type TrialOfferView =
  | { kind: "loading" }
  | { kind: "skip" }
  | { kind: "offer"; headline: string; plans: TrialOfferPlanLine[] };

export function trialOfferView(snapshot: Pick<BillingSnapshot, "phase" | "plans">): TrialOfferView {
  if (snapshot.phase === "idle" || snapshot.phase === "loading") return { kind: "loading" };
  // Only a settled, successful load can promise anything. Unavailable, failed or any purchase state: no promise.
  if (snapshot.phase !== "ready") return { kind: "skip" };

  const withTrial = snapshot.plans.filter((p) => p.trial);
  if (withTrial.length === 0) return { kind: "skip" };

  const labels = new Set(withTrial.map((p) => p.trial?.label));
  const label = labels.size === 1 ? withTrial[0].trial?.label : null;
  return {
    kind: "offer",
    headline: label ? `Try the App Subscription free for ${label}` : "Try the App Subscription free",
    plans: withTrial.map((p) => ({ billingOptionId: p.billingOptionId, title: p.title, line: trialHeadline(p.trial?.label ?? "", p.displayPrice, p.periodLabel) })),
  };
}
