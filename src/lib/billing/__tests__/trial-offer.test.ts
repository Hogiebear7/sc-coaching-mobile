// The onboarding trial offer: it promises a trial only when the STORE says the member is eligible, uses only store strings, never buys anything, never blocks,
// and the same offer remains in Settings. Pure view logic plus source checks on the pieces that wire it in. Mocked only: nothing here has run on a device.
import { describe, expect, it } from "vitest";

import homeSource from "@/app/(tabs)/index.tsx?raw";
import signupSource from "@/app/(auth)/signup.tsx?raw";
import layoutSource from "@/app/_layout.tsx?raw";
import settingsSource from "@/app/settings.tsx?raw";
import subscribeSource from "@/app/subscribe.tsx?raw";
import offerScreenSource from "@/app/trial-offer.tsx?raw";
// The same file is imported twice on purpose: once as text (source checks below), once as code.
/* eslint-disable import/no-duplicates */
import offerLogicSource from "@/lib/billing/trial-offer.ts?raw";
import { trialOfferView } from "@/lib/billing/trial-offer";
/* eslint-enable import/no-duplicates */
import type { StorePlan } from "@/lib/billing/types";

const plan = (over: Partial<StorePlan> = {}): StorePlan => ({
  billingOptionId: "m",
  productId: "p.monthly",
  title: "Monthly",
  displayPrice: "STORE-PRICE-M",
  periodLabel: "per month",
  intervalUnit: "month",
  intervalCount: 1,
  basePlanId: null,
  offerToken: null,
  trial: null,
  ...over,
});
// Source with comments removed, so a rule like "no countdown" is checked against what the code DOES, not what its comments say.
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("trialOfferView: promise a trial only when the store says so", () => {
  it("waits while the store has not answered", () => {
    expect(trialOfferView({ phase: "idle", plans: [] })).toEqual({ kind: "loading" });
    expect(trialOfferView({ phase: "loading", plans: [] })).toEqual({ kind: "loading" });
  });

  it("shows nothing when the store could not answer, or billing failed: eligibility unknown means no promise", () => {
    for (const phase of ["unavailable", "failed", "pending", "success", "purchasing", "verifying"] as const) {
      expect(trialOfferView({ phase, plans: [plan({ trial: { label: "STORE-TRIAL" } })] })).toEqual({ kind: "skip" });
    }
  });

  it("shows nothing when the store returned plans without a trial (already used, ineligible, or not offered)", () => {
    expect(trialOfferView({ phase: "ready", plans: [plan(), plan({ billingOptionId: "y", title: "Yearly" })] })).toEqual({ kind: "skip" });
    expect(trialOfferView({ phase: "ready", plans: [] })).toEqual({ kind: "skip" });
  });

  it("offers the trial with the store's own length, full price and billing period, and nothing else", () => {
    const view = trialOfferView({
      phase: "ready",
      plans: [
        plan({ trial: { label: "STORE-TRIAL" } }),
        plan({ billingOptionId: "y", title: "Yearly", displayPrice: "STORE-PRICE-Y", periodLabel: "per year", trial: { label: "STORE-TRIAL" } }),
      ],
    });
    expect(view).toEqual({
      kind: "offer",
      headline: "Try the App Subscription free for STORE-TRIAL",
      plans: [
        { billingOptionId: "m", title: "Monthly", line: "STORE-TRIAL free, then STORE-PRICE-M per month" },
        { billingOptionId: "y", title: "Yearly", line: "STORE-TRIAL free, then STORE-PRICE-Y per year" },
      ],
    });
  });

  it("lists only the plans the store gave a trial to, and names no length when the plans disagree", () => {
    const view = trialOfferView({
      phase: "ready",
      plans: [plan({ trial: { label: "A" } }), plan({ billingOptionId: "y", title: "Yearly", trial: { label: "B" } }), plan({ billingOptionId: "s", title: "Six months" })],
    });
    expect(view.kind === "offer" && view.plans.map((p) => p.billingOptionId)).toEqual(["m", "y"]);
    expect(view.kind === "offer" && view.headline).toBe("Try the App Subscription free");
  });
});

describe("no hard-coded price, length or promise in the onboarding offer", () => {
  it("neither the view logic nor the screen contains a price, a currency, or a trial length", () => {
    for (const [file, source] of [["trial-offer.ts", offerLogicSource], ["trial-offer.tsx", offerScreenSource]] as const) {
      expect(code(source), file).not.toMatch(/€|£|\$\d|12\.99|84\b|\b7[- ]day|seven/i);
    }
  });

  it("the offer states renewal and cancellation terms from the shared store disclosure, and says Free tier stays available", () => {
    const screen = code(offerScreenSource);
    expect(screen).toContain("autoRenewDisclosure(platform, { trial: true })");
    expect(screen).toMatch(/Free tier stays as it is/);
    expect(screen).toMatch(/Settings, under App Subscription/);
  });
});

describe("it never blocks, never buys, never pressures", () => {
  const screen = code(offerScreenSource);

  it("has a Not now that simply goes back, and starts nothing itself (the purchase happens only on the subscription screen)", () => {
    expect(screen).toMatch(/Not now/);
    expect(screen).toContain("onPress={() => router.back()}");
    expect(screen).not.toMatch(/\.buy\(|\.restore\(|requestPurchase|purchase\(/);
    expect(screen).toContain("router.replace(DIGITAL_PLAN_ROUTE");
  });

  it("has no countdown, deadline, timer or expiry", () => {
    expect(screen).not.toMatch(/setInterval|setTimeout|countdown|deadline|expires|hours left|ends in|limited time|last chance|Date\.now|new Date/i);
  });

  it("is shown once after signup (a one-shot flag the Home screen clears), only in a build that sells the plan, and creating the account starts no trial", () => {
    const signup = code(signupSource);
    expect(signup).toMatch(/if \(CAN_SELL_DIGITAL_PLAN\) await AsyncStorage\.setItem\(POST_SIGNUP_TRIAL_OFFER_KEY_PREFIX/);
    expect(signup).not.toMatch(/buy\(|trial:|startTrial/);
    const home = code(homeSource);
    expect(home).toContain("AsyncStorage.removeItem(POST_SIGNUP_TRIAL_OFFER_KEY_PREFIX");
    expect(home).toContain("handled.current = true");
    expect(home).toMatch(/if \(!CAN_SELL_DIGITAL_PLAN \|\| !user \|\| !profile/);
    expect(home).toMatch(/if \(profile\.accessSupported && !profile\.memberAccess\.digital\) router\.push\("\/trial-offer"/);
  });

  it("the offer waits for the onboarding steps rather than stacking on them (App v2: onboarding is its own screen)", () => {
    const home = code(homeSource);
    // Read together with the onboarding flag; while that is still set, nothing is shown and the offer is checked again on the next visit to Home.
    expect(home).toContain("AsyncStorage.getItem(POST_SIGNUP_SETUP_KEY_PREFIX");
    expect(home).toMatch(/if \(cancelled \|\| !offer \|\| setupStillPending \|\| handled\.current\) return;/);
    expect(home).toContain("useFocusEffect(");
  });

  it("the offer screen leaves quietly when the store shows no trial, and the offer stays reachable later from Settings > App Subscription", () => {
    expect(screen).toMatch(/nothingToOffer = !controller \|\| view\.kind === "skip"/);
    const settings = code(settingsSource);
    expect(settings).toMatch(/title="App Subscription"/);
    expect(settings).toContain("router.push(DIGITAL_PLAN_ROUTE");
    // The paywall itself shows the trial only when the store returned it, with the full price after it.
    const paywall = code(subscribeSource);
    expect(paywall).toContain("trialHeadline(plan.trial.label, plan.displayPrice, plan.periodLabel)");
  });

  it("the screen is registered in the root stack as a normal, dismissible card", () => {
    expect(code(layoutSource)).toContain('<Stack.Screen name="trial-offer" options={{ presentation: "card" }} />');
  });
});

describe("signup keeps its behaviour after the two lint fixes (set-state-in-effect)", () => {
  const signup = code(signupSource);

  it("the shown step is clamped to the steps that exist, derived instead of corrected inside an effect", () => {
    expect(signup).toContain("const step = Math.min(requestedStep, totalSteps - 1);");
    expect(signup).not.toMatch(/if \(step > totalSteps - 1\) setStep/);
    expect(signup).toContain("setStep(Math.min(step + 1, totalSteps - 1))");
    expect(signup).toContain("setStep(Math.max(step - 1, 0))");
  });

  it("the email status is derived: idle until it looks like an email, checking until the outcome for THAT email arrives, and a failed check is idle", () => {
    expect(signup).not.toContain("setEmailStatus");
    expect(signup).toMatch(/!EMAIL_RE\.test\(trimmedEmail\)\s*\?\s*"idle"\s*:\s*emailCheck\?\.email === trimmedEmail\s*\?\s*emailCheck\.status\s*:\s*"checking"/);
    expect(signup).toContain('setEmailCheck({ email, status: "idle" })');
    expect(signup).toContain('data.available === false ? "taken" : "available"');
  });
});
