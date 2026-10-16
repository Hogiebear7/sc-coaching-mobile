// @ts-nocheck -- scans the source tree with Node's fs and path; the app tsconfig has no Node types. It runs under vitest (Node), not in the app.
// What the app may offer to buy is decided in one place (src/lib/upsell-config.ts), and every call to action that leads to a purchase must be governed by it.
//
// Owner decision D3 (2026-10-15): the App Subscription is bought ONLY through the store's billing, inside the app. There is no website purchase flow for it, so the
// retired "web_checkout" mode must not turn anything on.
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAN_LINK_GYM_MEMBERSHIP, CAN_SELL_DIGITAL_PLAN, DIGITAL_PLAN_ROUTE, notInPlanCopy, UPSELL_MODE } from "@/lib/upsell-config";

async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, undefined as never);
    else vi.stubEnv(k, v);
  }
  return import("@/lib/upsell-config");
}
afterEach(() => vi.unstubAllEnvs());

describe("upsell configuration", () => {
  it("defaults to informational: the digital plan is not offered and no gym-membership hand-off is shown", () => {
    expect(process.env.EXPO_PUBLIC_UPSELL_MODE).toBeUndefined();
    expect(UPSELL_MODE).toBe("informational");
    expect(CAN_SELL_DIGITAL_PLAN).toBe(false);
    expect(CAN_LINK_GYM_MEMBERSHIP).toBe(false);
  });

  it("store_purchase turns on the in-app purchase flow, and nothing else", async () => {
    const config = await loadWith({ EXPO_PUBLIC_UPSELL_MODE: "store_purchase" });
    expect(config.UPSELL_MODE).toBe("store_purchase");
    expect(config.CAN_SELL_DIGITAL_PLAN).toBe(true);
    expect(config.CAN_LINK_GYM_MEMBERSHIP).toBe(false);
  });

  it.each(["web_checkout", "true", "1", "STORE_PURCHASE", ""])("%s does NOT turn the purchase flow on (the website checkout for the digital plan is retired)", async (value) => {
    const config = await loadWith({ EXPO_PUBLIC_UPSELL_MODE: value });
    expect(config.UPSELL_MODE).toBe("informational");
    expect(config.CAN_SELL_DIGITAL_PLAN).toBe(false);
  });

  it("the gym-membership hand-off is its own switch, off unless exactly true", async () => {
    expect((await loadWith({ EXPO_PUBLIC_GYM_MEMBERSHIP_LINK: "true" })).CAN_LINK_GYM_MEMBERSHIP).toBe(true);
    expect((await loadWith({ EXPO_PUBLIC_GYM_MEMBERSHIP_LINK: "1" })).CAN_LINK_GYM_MEMBERSHIP).toBe(false);
    expect((await loadWith({ EXPO_PUBLIC_GYM_MEMBERSHIP_LINK: "true", EXPO_PUBLIC_UPSELL_MODE: undefined })).CAN_SELL_DIGITAL_PLAN).toBe(false);
  });

  it("the plain copy names no price and offers no upgrade when nothing is for sale", () => {
    const text = notInPlanCopy("Chat with the AI Coach");
    expect(text).toBe("Chat with the AI Coach — not included in your current plan.");
    expect(text).not.toMatch(/upgrade|subscription|price|£|€|\$/i);
  });

  it("where the plan is for sale the copy says what includes it, still without a price", async () => {
    const config = await loadWith({ EXPO_PUBLIC_UPSELL_MODE: "store_purchase" });
    const text = config.notInPlanCopy("Chat with the AI Coach");
    expect(text).toBe("Chat with the AI Coach — included with the App Subscription.");
    expect(text).not.toMatch(/£|€|\$|\d/);
  });

  it("the paywall is one fixed route", () => {
    expect(DIGITAL_PLAN_ROUTE).toBe("/subscribe");
  });
});

describe("every purchase-promoting entry point is governed by the config", () => {
  const root = path.join(process.cwd(), "src");
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = path.join(d, n);
      return statSync(p).isDirectory() ? (n === "__tests__" ? [] : walk(p)) : /\.(tsx?|ts)$/.test(n) ? [p] : [];
    });
  const files = walk(root);
  const rel = (f: string) => path.relative(process.cwd(), f).split(path.sep).join("/");
  const stripComments = (src: string) => src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

  it("any screen that says Upgrade, sells plans, opens the paywall or opens the plan page on the web imports upsell-config", () => {
    const promoting = /Upgrade|upgrade for|app plans|View plans on web|Manage membership on web|Get started<\/Text>|\/dashboard\/membership|DIGITAL_PLAN_ROUTE|"\/subscribe"/;
    const offenders = files
      .filter((f) => !f.endsWith("upsell-config.ts"))
      .filter((f) => promoting.test(stripComments(readFileSync(f, "utf8"))))
      .filter((f) => !readFileSync(f, "utf8").includes("@/lib/upsell-config"))
      .map(rel);
    // push-notifications.ts only maps an incoming notification link to a screen; it opens nothing on the web and promotes nothing.
    // membership-web.ts (used by membership.tsx and gym.tsx) is the one sanctioned web link: in-person gym memberships, which store rules
    // let members pay for outside the app. The page they open is limited to in-person plans (checked below).
    expect(offenders).toEqual([
      "src/app/membership.tsx",
      "src/lib/membership-web.ts",
      "src/lib/push-notifications.ts",
    ]);
  });

  it("the in-person membership link only ever opens the in-person view of the web page", () => {
    const helper = readFileSync(path.join(root, "lib", "membership-web.ts"), "utf8");
    expect(helper).toMatch(/\/dashboard\/membership\?source=app/);
    for (const f of ["app/gym.tsx", "app/membership.tsx"]) {
      const src = readFileSync(path.join(root, f), "utf8");
      expect(src).toContain("@/lib/membership-web");
      expect(src).not.toMatch(/Linking\.openURL\([^)]*dashboard\/membership/);
    }
  });

  it("only the billing module touches the native purchase library, and only it can start or finish a purchase", () => {
    const touching = files.filter((f) => /["']expo-iap["']/.test(stripComments(readFileSync(f, "utf8")))).map(rel);
    expect(touching).toEqual(["src/lib/billing/expo-iap-billing.ts"]);
    const callers = files.filter((f) => /requestPurchase|finishTransaction|initConnection/.test(stripComments(readFileSync(f, "utf8")))).map(rel);
    expect(callers).toEqual(["src/lib/billing/expo-iap-billing.ts"]);
  });

  it("no screen shows a hard-coded price: the only price on screen is the store's own string", () => {
    const priced = files
      .filter((f) => !f.includes("/billing/") && !/community|nutrition|workout|food|recipe|macro|body|calorie|weight/i.test(f))
      .filter((f) => /[£€$]\s?\d{1,3}([.,]\d{2})?\s*(\/|per)\s*(month|mo|year|yr)/i.test(stripComments(readFileSync(f, "utf8"))))
      .map(rel);
    expect(priced).toEqual([]);
  });

  it("the web checkout for the digital plan is gone from the mobile app", () => {
    const sources = files.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");
    expect(sources).not.toMatch(/web_checkout/);
  });
});
