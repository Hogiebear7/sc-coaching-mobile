// Whether the app may PROMOTE buying a plan: "Upgrade" badges, links and buttons that lead to a purchase, and copy that sells app plans.
//
// "informational" (the default, and what the store builds use): the app never shows an Upgrade call to action, a price, or a link/button that leads to buying
// anything. Locked features say they aren't part of the member's current plan and nothing more. This is the configuration that fits Apple App Review 3.1.1 and
// Google Play's payments policy when the app unlocks digital features (AI coach, food search, programme generation) for members whose plan was arranged with the
// gym, with no in-app purchase and no external-purchase-link entitlement in place.
//
// "web_checkout": the original behaviour, where those entry points open the plan/checkout page on the website. Intended for development and staging builds, or for
// a store build only once the owner has decided the commercial model and the matching store entitlements are in place (see the release handover). Set with
// EXPO_PUBLIC_UPSELL_MODE=web_checkout at build time.
export type UpsellMode = "informational" | "web_checkout";

export const UPSELL_MODE: UpsellMode = process.env.EXPO_PUBLIC_UPSELL_MODE === "web_checkout" ? "web_checkout" : "informational";

/** True only when the app is allowed to promote a purchase (see above). */
export const CAN_PROMOTE_PURCHASE = UPSELL_MODE === "web_checkout";

/** "<feature> — available on App Subscription and above." where promoting is allowed, otherwise a plain statement that it isn't in the member's plan. */
export const notInPlanCopy = (what: string) =>
  CAN_PROMOTE_PURCHASE ? `${what} — available on App Subscription and above.` : `${what} — not included in your current plan.`;
