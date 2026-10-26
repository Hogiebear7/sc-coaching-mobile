// @ts-nocheck -- scans the source tree with Node's fs and path; the app tsconfig has no Node types. It runs under vitest (Node), not in the app.
// The store builds must never promote a purchase (Apple 3.1.1 / Google Play payments): informational mode is the default, and every screen that can show an
// "Upgrade" call to action or navigate to the plan/checkout page must be governed by src/lib/upsell-config.ts.
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { CAN_PROMOTE_PURCHASE, notInPlanCopy, UPSELL_MODE } from "@/lib/upsell-config";

describe("upsell configuration", () => {
  it("defaults to informational: no purchase promotion unless the build opts in", () => {
    expect(process.env.EXPO_PUBLIC_UPSELL_MODE).toBeUndefined();
    expect(UPSELL_MODE).toBe("informational");
    expect(CAN_PROMOTE_PURCHASE).toBe(false);
  });

  it("the plain copy names no plan and offers no upgrade", () => {
    const text = notInPlanCopy("Chat with the AI Coach");
    expect(text).toBe("Chat with the AI Coach — not included in your current plan.");
    expect(text).not.toMatch(/upgrade|subscription|price|£|€|\$/i);
  });
});

describe("every purchase-promoting entry point is governed by the config", () => {
  const root = path.join(process.cwd(), "src");
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? (n === "__tests__" ? [] : walk(p)) : /\.(tsx?|ts)$/.test(n) ? [p] : []; });
  const files = walk(root);
  const rel = (f: string) => path.relative(process.cwd(), f).split(path.sep).join("/");

  it("any screen that says Upgrade, sells app plans or opens the plan page on the web imports upsell-config", () => {
    const promoting = /Upgrade|upgrade for|app plans|View plans on web|Manage membership on web|Get started<\/Text>|\/dashboard\/membership/;
    const offenders = files
      .filter((f) => !f.endsWith("upsell-config.ts"))
      .filter((f) => promoting.test(readFileSync(f, "utf8").split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n")))
      .filter((f) => !readFileSync(f, "utf8").includes("@/lib/upsell-config"))
      .map(rel);
    // push-notifications.ts only maps an incoming notification link to a screen; it opens nothing on the web and promotes nothing.
    expect(offenders).toEqual(["src/lib/push-notifications.ts"]);
  });
});
