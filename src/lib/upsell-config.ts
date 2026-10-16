// What the app may OFFER TO BUY, decided at build time. Two separate products, two separate switches (owner decision D1, 2026-10-15):
//
//   1. The App Subscription (the digital features: AI chat, programme generation, food search, tracker import ...). It is sold ONLY through Google Play and the
//      App Store, inside the app (D3: there is no website purchase flow for it). Governed by UPSELL_MODE below.
//   2. A gym Membership (classes, passes, coach messaging). A real-world service the gym sells outside the app stores. The app never sells it; whether the
//      Membership screen may hand the member off to the gym's website is a SEPARATE policy decision, governed by CAN_LINK_GYM_MEMBERSHIP below.
//
// UPSELL_MODE
//   "informational" (the default): the app never shows an Upgrade call to action, a price, or a button that leads to buying the digital plan. A locked feature
//     says it isn't part of the member's current plan and nothing more. THIS IS NOT THE LAUNCH PURCHASE FLOW: with it, a member has no way to buy the
//     digital plan, so it is only for builds that must not sell (and for the reviewers' comparison).
//   "store_purchase": the in-app purchase flow is on. Locked digital features open the paywall (src/app/subscribe.tsx), which sells the plan through the
//     store's own billing (src/lib/billing). The prices it shows are the ones the STORE reports, never ones this app or the server states.
//   Set with EXPO_PUBLIC_UPSELL_MODE=store_purchase at build time. Any other value (including the retired "web_checkout") is "informational".
//
// Even in "store_purchase" the server decides whether purchases are accepted (its kill switches default OFF), and the paywall says so plainly when the store or
// the server cannot sell right now. Turning this on in a build is a launch decision: see the owner-action checklist.
export type UpsellMode = "informational" | "store_purchase";

export const UPSELL_MODE: UpsellMode = process.env.EXPO_PUBLIC_UPSELL_MODE === "store_purchase" ? "store_purchase" : "informational";

/** True only when the app may offer the digital plan for purchase through the store billing (see above). */
export const CAN_SELL_DIGITAL_PLAN = UPSELL_MODE === "store_purchase";

/**
 * Whether the Membership screen may hand the member off to the gym's website to buy or change a gym Membership. Off by default: it is a store-policy decision for
 * the owner (external purchase links), independent of the digital plan. Set with EXPO_PUBLIC_GYM_MEMBERSHIP_LINK=true at build time.
 */
export const CAN_LINK_GYM_MEMBERSHIP = process.env.EXPO_PUBLIC_GYM_MEMBERSHIP_LINK === "true";

/** "<feature> — included with the App Subscription." where the digital plan may be offered, otherwise a plain statement that it isn't in the member's plan. */
export const notInPlanCopy = (what: string) =>
  CAN_SELL_DIGITAL_PLAN ? `${what} — included with the App Subscription.` : `${what} — not included in your current plan.`;

/** Where a locked digital feature sends the member: the paywall, or nowhere in informational mode. */
export const DIGITAL_PLAN_ROUTE = "/subscribe";
