// An older or incompatible server must never crash the app or grant paid access. Regression for the startup crash where `profile.memberAccess` was undefined.
import { describe, expect, it } from "vitest";

import { NO_ACCESS } from "@/lib/member-access";
import { OUT_OF_DATE_SERVER_MESSAGE, readProfileAccess } from "@/lib/profile-access";

describe("readProfileAccess fails closed", () => {
  it("a current server: the flags are used as sent, and billing is supported", () => {
    expect(readProfileAccess({ memberAccess: { digital: true, gymMembership: false }, digitalPlan: { source: "app_store" } })).toEqual({
      memberAccess: { digital: true, gymMembership: false },
      digitalPlan: { source: "app_store" },
      accessSupported: true,
    });
    expect(readProfileAccess({ memberAccess: { digital: false, gymMembership: true } }).accessSupported).toBe(true);
  });

  it("an older server that sends only the retired ranked tier: NO access, billing unsupported, and the old tier is NOT translated into access", () => {
    for (const memberTier of ["membership", "app_subscription", "free"]) {
      const result = readProfileAccess({ memberTier } as never);
      expect(result.memberAccess).toEqual(NO_ACCESS);
      expect(result.accessSupported).toBe(false);
      expect(result.digitalPlan).toBeNull();
    }
  });

  it.each([undefined, null, {}, { memberAccess: null }, { memberAccess: {} }, { memberAccess: { digital: true } }, { memberAccess: { gymMembership: true } }, { memberAccess: { digital: "true", gymMembership: 1 } }, { memberAccess: "digital" }, { memberAccess: [] }])(
    "a missing or malformed answer %# grants nothing and marks billing unsupported",
    (raw) => {
      const result = readProfileAccess(raw as never);
      expect(result).toEqual({ memberAccess: { digital: false, gymMembership: false }, digitalPlan: null, accessSupported: false });
    }
  );

  it("a partly valid answer never keeps the half that says yes", () => {
    expect(readProfileAccess({ memberAccess: { digital: true } } as never).memberAccess.digital).toBe(false);
  });

  it("the fallback is not the shared NO_ACCESS object, so nothing can mutate it into a grant", () => {
    const result = readProfileAccess(undefined);
    result.memberAccess.digital = true;
    expect(NO_ACCESS.digital).toBe(false);
  });

  it("the message to the member says subscriptions are off and nothing was charged", () => {
    expect(OUT_OF_DATE_SERVER_MESSAGE).toMatch(/switched off/);
    expect(OUT_OF_DATE_SERVER_MESSAGE).toMatch(/Nothing has been charged/);
  });
});
