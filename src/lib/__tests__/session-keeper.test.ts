import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock("../api-client", () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return { ApiError };
});

import { ApiError } from "../api-client";
import { signInCheckFailure } from "../session-keeper";

describe("staying signed in", () => {
  it("signs out only when the server rejects the sign-in", () => {
    expect(signInCheckFailure(new ApiError(401, "Not signed in."))).toBe("signOut");
  });
  it("keeps the member signed in when there's no signal or the server hiccups", () => {
    expect(signInCheckFailure(new ApiError(0, "Can't reach the server."))).toBe("keep");
    expect(signInCheckFailure(new ApiError(502, "Bad gateway"))).toBe("keep");
    expect(signInCheckFailure(new ApiError(503, "Restarting"))).toBe("keep");
    expect(signInCheckFailure(new Error("timeout"))).toBe("keep");
  });
});
