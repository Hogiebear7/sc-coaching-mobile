import { describe, expect, it } from "vitest";

import { describeOutcome } from "../outcome-copy";
import type { BillingOutcome } from "../types";

const ALL: BillingOutcome[] = [
  { kind: "unavailable", reason: "disabled" },
  { kind: "blocked", code: "membership_active", message: "blocked text" },
  { kind: "cancelled" },
  { kind: "pending", where: "store" },
  { kind: "pending", where: "server" },
  { kind: "verified", purchase: { tier: "app_subscription", status: "active", acknowledged: true } },
  { kind: "needs_retry", reason: "server_unreachable" },
  { kind: "rejected", code: "owned_by_other", message: "m" },
  { kind: "rejected", code: "binding_required", message: "m" },
  { kind: "nothing_to_restore" },
  { kind: "error", message: "The purchase could not be completed." },
];

describe("describeOutcome", () => {
  it("says nothing when the member cancelled", () => {
    expect(describeOutcome({ kind: "cancelled" })).toBeNull();
  });

  it("gives every other outcome a title and a body", () => {
    for (const outcome of ALL.filter((o) => o.kind !== "cancelled")) {
      const message = describeOutcome(outcome);
      expect(message?.title.length).toBeGreaterThan(3);
      expect(message?.body.length).toBeGreaterThan(10);
    }
  });

  it("tells the member not to buy again while a paid purchase is unconfirmed", () => {
    expect(describeOutcome({ kind: "needs_retry", reason: "server_unreachable" })?.body).toMatch(/don't need to buy again/);
    expect(describeOutcome({ kind: "pending", where: "server" })?.body).toMatch(/don't need to buy again/);
  });

  it("never exposes a code, token or internal word", () => {
    for (const outcome of ALL) {
      const text = JSON.stringify(describeOutcome(outcome));
      expect(text).not.toMatch(/binding|token|membership_active|obfuscated|iap_/i);
    }
  });

  it("uses the success tone only for a verified purchase", () => {
    const tones = ALL.map((o) => [o.kind, describeOutcome(o)?.tone] as const);
    expect(tones.filter(([, t]) => t === "success").map(([k]) => k)).toEqual(["verified"]);
  });
});
