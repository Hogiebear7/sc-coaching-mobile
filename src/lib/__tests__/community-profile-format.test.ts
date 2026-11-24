import { describe, expect, it } from "vitest";

import { LEADERBOARD_MODE_OPTIONS, PROFILE_VISIBILITY_OPTIONS, WHO_CAN_FOLLOW_OPTIONS, formatMemberSince, formatVolumeKg, sessionsLabel } from "../community-profile-format";

describe("formatVolumeKg", () => {
  it("rounds and adds thousands separators", () => {
    expect(formatVolumeKg(0)).toBe("0 kg");
    expect(formatVolumeKg(850.4)).toBe("850 kg");
    expect(formatVolumeKg(12400)).toBe("12,400 kg");
    expect(formatVolumeKg(1234567)).toBe("1,234,567 kg");
  });
  it("never shows a bad number", () => {
    expect(formatVolumeKg(NaN)).toBe("0 kg");
    expect(formatVolumeKg(-5)).toBe("0 kg");
  });
});

describe("formatMemberSince", () => {
  it("names the month", () => {
    expect(formatMemberSince("2026-03")).toBe("March 2026");
    expect(formatMemberSince("2025-12")).toBe("December 2025");
  });
  it("leaves out a bad or missing month", () => {
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince("2026-13")).toBeNull();
    expect(formatMemberSince("soon")).toBeNull();
  });
});

describe("labels", () => {
  it("pluralises sessions", () => {
    expect(sessionsLabel(1)).toBe("1 session");
    expect(sessionsLabel(0)).toBe("0 sessions");
  });
  it("lists every option once, in the agreed order", () => {
    expect(PROFILE_VISIBILITY_OPTIONS.map((o) => o.value)).toEqual(["followers", "followers_gym", "everyone"]);
    expect(WHO_CAN_FOLLOW_OPTIONS.map((o) => o.value)).toEqual(["anyone", "gym", "nobody"]);
    expect(LEADERBOARD_MODE_OPTIONS.map((o) => o.value)).toEqual(["named", "alias", "hidden"]);
  });
});
