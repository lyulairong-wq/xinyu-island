import { afterEach, describe, expect, it, vi } from "vitest";
import { MockAiProvider, OpenAiCompatibleProvider, type AiProvider } from "./index";

async function collect(provider: AiProvider) {
  const events = [];
  for await (const event of provider.generate({
    conversationId: "conversation-1",
    content: "hello",
    mode: "free",
    maxOutputTokens: 512,
    systemPrompt: "be concise"
  })) events.push(event);
  return events;
}

describe("OpenAiCompatibleProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the output cap and configured bearer key to an OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "  model reply  " } }],
      usage: { prompt_tokens: 12, completion_tokens: 4 }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const events = await collect(new OpenAiCompatibleProvider("http://localhost:8000/v1/", "local-model", { apiKey: "secret-key" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer secret-key" },
        body: expect.stringContaining('"max_tokens":512')
      })
    );
    expect(events).toEqual([
      { type: "started", provider: "local-model" },
      { type: "delta", text: "model reply", provider: "local-model" },
      { type: "completed", text: "model reply", provider: "local-model", inputTokens: 12, outputTokens: 4 }
    ]);
  });

  it("normalizes an empty completion to EMPTY_RESPONSE", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 })));

    const events = await collect(new OpenAiCompatibleProvider("http://localhost:8000/v1", "local-model"));

    expect(events).toEqual([
      { type: "started", provider: "local-model" },
      { type: "failed", provider: "local-model", errorCode: "EMPTY_RESPONSE" }
    ]);
  });

  it("normalizes non-success responses without exposing their body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("internal diagnostic", { status: 503 })));

    const events = await collect(new OpenAiCompatibleProvider("http://localhost:8000/v1", "local-model"));

    expect(events).toEqual([
      { type: "started", provider: "local-model" },
      { type: "failed", provider: "local-model", errorCode: "UNAVAILABLE" }
    ]);
  });

  it("normalizes aborted requests to TIMEOUT", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("request aborted", "AbortError"); }));

    const events = await collect(new OpenAiCompatibleProvider("http://localhost:8000/v1", "local-model"));

    expect(events).toEqual([
      { type: "started", provider: "local-model" },
      { type: "failed", provider: "local-model", errorCode: "TIMEOUT" }
    ]);
  });
});

describe("MockAiProvider", () => {
  it("identifies deterministic generated events as mock", async () => {
    const events = await collect(new MockAiProvider());

    expect(events[0]).toEqual({ type: "started", provider: "mock" });
    expect(events[1]).toMatchObject({ type: "delta", provider: "mock" });
    expect(events[2]).toMatchObject({ type: "completed", provider: "mock" });
  });

  it("uses a strict-Chinese default greeting", async () => {
    const events = [];
    for await (const event of new MockAiProvider().generate({
      conversationId: "conversation-1",
      content: "你好",
      mode: "free",
      maxOutputTokens: 512
    })) events.push(event);

    const completed = events.find((event) => event.type === "completed");
    expect(completed).toMatchObject({ provider: "mock" });
    expect(completed?.text).toContain("你好");
    expect(completed?.text).not.toMatch(/\p{Script=Latin}/u);
  });
});
