import { describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  setNotificationHandler: () => {},
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  getLastNotificationResponse: () => null,
  AndroidImportance: {},
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-device", () => ({}));
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("@/lib/api-client", () => ({ apiFetch: () => Promise.resolve({}) }));

import { mapLinkHrefToRoute } from "../push-notifications";

describe("mapLinkHrefToRoute: class recap", () => {
  it("opens the member's own copy of the class workout", () => {
    expect(mapLinkHrefToRoute("/dashboard/workouts/class/abc-123")).toBe("/edit-class-workout?id=abc-123");
  });

  it("does not turn anything else under that path into a screen", () => {
    expect(mapLinkHrefToRoute("/dashboard/workouts/class/a/b")).toBe("/(tabs)");
    expect(mapLinkHrefToRoute("/dashboard/workouts/class/")).toBe("/(tabs)");
  });

  it("leaves the other links as they were", () => {
    expect(mapLinkHrefToRoute("/dashboard/schedule")).toBe("/(tabs)/schedule");
    expect(mapLinkHrefToRoute("/community/workout/9")).toBe("/community/workout/9");
  });
});

describe("mapLinkHrefToRoute: challenge notices", () => {
  it("opens the challenge screen straight from a new-challenge or started notice, query and all", () => {
    const link = "/community/challenge?scope=group&groupId=g1&challengeId=ch1";
    expect(mapLinkHrefToRoute(link)).toBe(link);
    expect(mapLinkHrefToRoute("/community/challenge?scope=gym&challengeId=ch2")).toBe("/community/challenge?scope=gym&challengeId=ch2");
  });
});
