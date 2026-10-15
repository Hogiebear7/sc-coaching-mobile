import { describe, expect, it } from "vitest";

import { canSubmitDeletion, DELETE_CONFIRM_WORD } from "@/lib/account-deletion";

describe("canSubmitDeletion", () => {
  it("needs both a password and the exact confirmation word", () => {
    expect(canSubmitDeletion("", DELETE_CONFIRM_WORD, false)).toBe(false);
    expect(canSubmitDeletion("secret", "", false)).toBe(false);
    expect(canSubmitDeletion("secret", "delete", false)).toBe(false);
    expect(canSubmitDeletion("secret", "DELETE ", false)).toBe(false);
    expect(canSubmitDeletion("secret", "DELETE", false)).toBe(true);
  });

  it("is disabled while a request is running, so a double tap cannot send twice", () => {
    expect(canSubmitDeletion("secret", "DELETE", true)).toBe(false);
  });
});
