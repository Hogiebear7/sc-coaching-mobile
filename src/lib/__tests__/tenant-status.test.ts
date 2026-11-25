import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async () => ({ ...(await vi.importActual<object>("react")), useSyncExternalStore: vi.fn() }));

import { TENANT_ACTIVE, getTenantStatus, graceBannerText, markTenantLocked, parseTenantStatus, resetTenantStatus, setTenantStatus } from "../tenant-status";

beforeEach(() => resetTenantStatus());

describe("the gym's platform-subscription status in the app", () => {
  it("an older server that sends nothing means active", () => {
    for (const raw of [undefined, null, "x", 5, {}, { state: "weird" }]) expect(parseTenantStatus(raw)).toEqual(TENANT_ACTIVE);
  });

  it("reads grace and locked, and accepts a pay link only if it is https", () => {
    expect(parseTenantStatus({ state: "grace", graceEndsOn: "2026-12-20", graceDaysLeft: 3, payUrl: "https://pay.example.test/x" })).toEqual({
      state: "grace", graceEndsOn: "2026-12-20", graceDaysLeft: 3, payUrl: "https://pay.example.test/x",
    });
    expect(parseTenantStatus({ state: "locked", payUrl: "http://insecure.test" }).payUrl).toBeNull();
    expect(parseTenantStatus({ state: "locked", payUrl: "javascript:alert(1)" }).payUrl).toBeNull();
    expect(parseTenantStatus({ state: "locked" }).state).toBe("locked");
  });

  it("a 423 locks the app while keeping the pay link the session check gave, and resetting (sign-out) clears it", () => {
    setTenantStatus({ state: "grace", graceEndsOn: "2026-12-20", graceDaysLeft: 1, payUrl: "https://pay.example.test/x" });
    markTenantLocked();
    expect(getTenantStatus()).toEqual({ state: "locked", graceEndsOn: null, graceDaysLeft: null, payUrl: "https://pay.example.test/x" });
    resetTenantStatus();
    expect(getTenantStatus()).toEqual(TENANT_ACTIVE);
  });

  it("the staff banner words the days left", () => {
    expect(graceBannerText({ ...TENANT_ACTIVE, state: "grace", graceDaysLeft: 5 })).toContain("in 5 days");
    expect(graceBannerText({ ...TENANT_ACTIVE, state: "grace", graceDaysLeft: 1 })).toContain("tomorrow");
    expect(graceBannerText({ ...TENANT_ACTIVE, state: "grace", graceDaysLeft: null })).toContain("soon");
  });
});
