// The mobile side of the AI data-sharing consent: when the server refuses an AI request with 403 ai_consent_required, the app asks the member; if they allow, the
// SAME request is sent once more; if they decline, it fails with a plain message and is not retried. Anything else is unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/constants/config", () => ({ API_BASE_URL: "http://api.test" }));
vi.mock("@/lib/token-store", () => ({ getToken: vi.fn(async () => "tok"), clearToken: vi.fn(async () => {}) }));

import { AI_DECLINED_MESSAGE, ApiError, apiFetch, apiFetchText, registerAiConsentHandler } from "@/lib/api-client";

const refusal = () => new Response(JSON.stringify({ success: false, code: "ai_consent_required", message: "Turn on AI features" }), { status: 403 });
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

let calls: { url: string; body: unknown }[];
function stubFetch(responses: (() => Response)[]) {
  calls = [];
  let i = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body?: string }) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : undefined });
    return responses[Math.min(i++, responses.length - 1)]();
  }));
}

beforeEach(() => registerAiConsentHandler(null));
afterEach(() => { registerAiConsentHandler(null); vi.unstubAllGlobals(); });

describe("apiFetch with AI consent", () => {
  it("asks the member, and when they allow it sends the identical request again exactly once", async () => {
    stubFetch([refusal, () => ok({ success: true, data: "answer" })]);
    const ask = vi.fn(async () => true);
    registerAiConsentHandler(ask);

    const out = await apiFetch<{ data: string }>("/api/mobile/nutrition/food/describe", { method: "POST", body: { text: "two eggs" } });

    expect(out.data).toBe("answer");
    expect(ask).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
  });

  it("when the member declines, fails with the plain message and does not retry", async () => {
    stubFetch([refusal]);
    registerAiConsentHandler(vi.fn(async () => false));

    await expect(apiFetch("/api/mobile/nutrition/food/describe", { method: "POST", body: { text: "x" } })).rejects.toMatchObject({ status: 403, message: AI_DECLINED_MESSAGE });
    expect(calls).toHaveLength(1);
  });

  it("does not loop: a second refusal after the member allowed it surfaces as an error", async () => {
    stubFetch([refusal, refusal]);
    const ask = vi.fn(async () => true);
    registerAiConsentHandler(ask);

    await expect(apiFetch("/api/mobile/nutrition/food/describe", { method: "POST", body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it("leaves every other 403 and other error alone, and never asks", async () => {
    stubFetch([() => new Response(JSON.stringify({ success: false, message: "Nope" }), { status: 403 })]);
    const ask = vi.fn(async () => true);
    registerAiConsentHandler(ask);

    await expect(apiFetch("/api/mobile/anything")).rejects.toMatchObject({ status: 403, message: "Nope" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("with no handler registered, the refusal is an ordinary error carrying the server's message", async () => {
    stubFetch([refusal]);
    await expect(apiFetch("/api/mobile/anything")).rejects.toMatchObject({ status: 403, message: "Turn on AI features" });
  });
});

describe("apiFetchText with AI consent", () => {
  it("asks, then retries the streamed-text request once when allowed", async () => {
    stubFetch([refusal, () => new Response("hello coach", { status: 200 })]);
    const ask = vi.fn(async () => true);
    registerAiConsentHandler(ask);

    await expect(apiFetchText("/api/ai/chat", { body: { content: "hi" } })).resolves.toBe("hello coach");
    expect(ask).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it("fails with the plain message when declined", async () => {
    stubFetch([refusal]);
    registerAiConsentHandler(vi.fn(async () => false));
    await expect(apiFetchText("/api/ai/chat", { body: { content: "hi" } })).rejects.toMatchObject({ message: AI_DECLINED_MESSAGE });
    expect(calls).toHaveLength(1);
  });
});
