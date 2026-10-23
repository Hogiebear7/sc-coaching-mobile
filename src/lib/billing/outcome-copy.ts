import type { BillingOutcome } from "./types";

// User-facing wording for each outcome. Plain verbs, says what happened and what to do next. Pure, so it is tested.
// `tone` lets the UI pick a style without re-deriving meaning from the outcome.
export interface OutcomeMessage {
  tone: "success" | "info" | "warning" | "error";
  title: string;
  body: string;
}

export function describeOutcome(outcome: BillingOutcome): OutcomeMessage | null {
  switch (outcome.kind) {
    case "verified":
      return { tone: "success", title: "You're subscribed", body: "Your App Subscription is active. Your features are unlocked." };
    case "cancelled":
      return null; // The member chose to stop. Say nothing.
    case "pending":
      return outcome.where === "store"
        ? { tone: "info", title: "Payment pending", body: "Google Play is still processing your payment. Your subscription starts as soon as it completes." }
        : { tone: "info", title: "Still confirming", body: "We're confirming your purchase with Google Play. This can take a few minutes. You don't need to buy again." };
    case "needs_retry":
      return {
        tone: "warning",
        title: "Purchase received, not confirmed yet",
        body: "Your purchase went through, but we couldn't confirm it yet. Keep the app open or come back shortly. You don't need to buy again.",
      };
    case "blocked":
      return { tone: "warning", title: "Can't subscribe right now", body: outcome.message };
    case "unavailable":
      return {
        tone: "info",
        title: "Not available right now",
        body: "Subscribing in the app isn't available yet. Check back soon.",
      };
    case "rejected":
      return {
        tone: "error",
        title: "We couldn't verify this purchase",
        body:
          outcome.code === "owned_by_other"
            ? "This purchase is already linked to another account."
            : "If you were charged and don't see your subscription, contact support. Unconfirmed purchases are refunded by Google Play.",
      };
    case "nothing_to_restore":
      return { tone: "info", title: "Nothing to restore", body: "We didn't find an App Subscription on this Google account." };
    case "error":
      return { tone: "error", title: "Something went wrong", body: outcome.message };
  }
}
