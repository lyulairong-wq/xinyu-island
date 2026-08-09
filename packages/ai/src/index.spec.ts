import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider } from "./index";

async function collect(provider: OpenAiCompatibleProvider) {
  const events = [];
  for await (const event of provider.generate({ conversationId: "conversation-1", content: "hello", mode: "free", systemPrompt: "be concise" })) events.push(event);
  return events;
}

describe("OpenAiCompatibleProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls an OpenAI-compatible chat completion endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "  model reply  " } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const events = await collect(new OpenAiCompatibleProvider("http://localhost:8000/v1/", "local-model"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/v1/chat/completions",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } })
    );
    expect(events).toEqual([
      { type: "started" },
      { type: "delta", text: "model reply" },
      { type: "completed", text: "model reply" }
    ]);
  });

  it("returns a failed event when the endpoint cannot provide a reply", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    const events = await collect(new OpenAiCompatibleProvider("http://localhost:8000/v1", "local-model"));

    expect(events[0]).toEqual({ type: "started" });
    expect(events[1]).toMatchObject({ type: "failed" });
  });
});
