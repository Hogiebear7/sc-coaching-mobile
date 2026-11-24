import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openProfile, openProfileFromModal } from "../open-profile";

describe("openProfile", () => {
  it("navigates to the profile card for that member, and does nothing without an id", () => {
    const push = vi.fn();
    openProfile({ push }, "u1");
    expect(push).toHaveBeenCalledWith({ pathname: "/community/profile/[userId]", params: { userId: "u1" } });
    openProfile({ push }, "");
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("openProfileFromModal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("closes the modal first and only navigates after it has dismissed, never in the same burst", () => {
    const push = vi.fn();
    const close = vi.fn();
    openProfileFromModal({ push }, "u2", close);
    expect(close).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(349);
    expect(push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(push).toHaveBeenCalledWith({ pathname: "/community/profile/[userId]", params: { userId: "u2" } });
  });

  it("does nothing at all without an id (the modal stays open)", () => {
    const push = vi.fn();
    const close = vi.fn();
    openProfileFromModal({ push }, "", close);
    vi.runAllTimers();
    expect(close).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
