// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "./auth-session";
import { listConversations, sendMessage } from "./chat-api";
import { listContacts } from "./contacts-api";
import { startSkillSession } from "./skills-api";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

describe("authenticated API clients", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("includes the stored browser token for chat, contacts and skills requests", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "stored-token");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await listConversations();
    await listContacts();
    await startSkillSession("conversation-1", { skill: "tarot", topic: "最近的感受", mode: "free", requestId });

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer stored-token");
    }
  });

  it("adds a UUID requestId to every generation request", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "stored-token");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({}), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(requestId);

    await sendMessage("conversation-1", { content: "你好", mode: "free" });
    await startSkillSession("conversation-1", { skill: "tarot", topic: "最近的感受", mode: "free" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(JSON.parse(String(init.body))).toMatchObject({ requestId });
    }
  });

  it("normalizes API details into an operational notice", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "stored-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "FREE_QUOTA_EXCEEDED",
      message: "internal quota implementation detail"
    }), { status: 429 })));

    await expect(listConversations()).rejects.toMatchObject({
      name: "OperationalApiError",
      status: 429,
      code: "FREE_QUOTA_EXCEEDED",
      notice: "今日免费额度已用完，请明天再试"
    });
  });
});
