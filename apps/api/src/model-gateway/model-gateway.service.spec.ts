import { describe, expect, it } from "vitest";
import type { AiProvider, GenerationEvent, GenerationRequest } from "@xinyu/ai";
import { ModelGatewayService } from "./model-gateway.service";

type ProviderBehavior = {
  available?: boolean;
  events?: GenerationEvent[];
  error?: Error;
};

function provider(behavior: ProviderBehavior): AiProvider {
  return {
    healthCheck: async () => ({ available: behavior.available ?? true }),
    async *generate(): AsyncIterable<GenerationEvent> {
      if (behavior.error) throw behavior.error;
      for (const event of behavior.events ?? []) yield event;
    }
  };
}

const request: GenerationRequest = {
  conversationId: "conversation-1",
  content: "How are you today?",
  mode: "free",
  maxOutputTokens: 128
};

describe("ModelGatewayService", () => {
  it("returns a primary response with provider metrics", async () => {
    const service = new ModelGatewayService({
      primary: provider({ events: [{ type: "completed", text: "Primary reply", inputTokens: 12, outputTokens: 4 }] }),
      local: provider({ events: [{ type: "completed", text: "Local reply" }] }),
      mock: provider({ events: [{ type: "completed", text: "Mock reply" }] })
    });

    await expect(service.generate(request)).resolves.toEqual({
      text: "Primary reply",
      provider: "primary",
      degraded: false,
      inputTokens: 12,
      outputTokens: 4
    });
  });

  it("uses the local provider after a primary timeout", async () => {
    const service = new ModelGatewayService({
      primary: provider({ events: [{ type: "failed", errorCode: "TIMEOUT" }] }),
      local: provider({ events: [{ type: "completed", text: "Local reply", inputTokens: 10, outputTokens: 3 }] }),
      mock: provider({ events: [{ type: "completed", text: "Mock reply" }] })
    });

    await expect(service.generate(request)).resolves.toEqual({
      text: "Local reply",
      provider: "local",
      degraded: true,
      inputTokens: 10,
      outputTokens: 3
    });
  });

  it("falls back to mock when primary and local generation fail", async () => {
    const service = new ModelGatewayService({
      primary: provider({ error: new Error("provider secret") }),
      local: provider({ events: [{ type: "failed", errorCode: "UNAVAILABLE" }] }),
      mock: provider({ events: [{ type: "completed", text: "Mock reply", inputTokens: 8, outputTokens: 2 }] })
    });

    await expect(service.generate(request)).resolves.toEqual({
      text: "Mock reply",
      provider: "mock",
      degraded: true,
      inputTokens: 8,
      outputTokens: 2
    });
  });

  it("falls back when a provider completes with empty text", async () => {
    const service = new ModelGatewayService({
      primary: provider({ events: [{ type: "completed", text: "   " }] }),
      local: provider({ events: [{ type: "completed", text: "Local reply", inputTokens: 11, outputTokens: 3 }] }),
      mock: provider({ events: [{ type: "completed", text: "Mock reply" }] })
    });

    await expect(service.generate(request)).resolves.toMatchObject({
      text: "Local reply",
      provider: "local",
      degraded: true
    });
  });

  it("releases a non-mock permit after a provider error", async () => {
    const service = new ModelGatewayService({
      primary: provider({ error: new Error("provider secret") }),
      local: provider({ events: [{ type: "completed", text: "Local reply" }] }),
      mock: provider({ events: [{ type: "completed", text: "Mock reply" }] })
    });

    const results = await Promise.all([service.generate(request), service.generate(request), service.generate(request)]);

    expect(results).toHaveLength(3);
    expect(results.every((result) => result.provider === "local" && result.degraded)).toBe(true);
  });

  it("lets at most two non-mock generations enter a blocking provider at once", async () => {
    let active = 0;
    let peakActive = 0;
    let entered: (() => void) | undefined;
    const twoEntered = new Promise<void>((resolve) => { entered = resolve; });
    let release: (() => void) | undefined;
    const unblock = new Promise<void>((resolve) => { release = resolve; });
    const blockingProvider: AiProvider = {
      healthCheck: async () => ({ available: true }),
      async *generate(): AsyncIterable<GenerationEvent> {
        active += 1;
        peakActive = Math.max(peakActive, active);
        if (active === 2) entered?.();
        await unblock;
        active -= 1;
        yield { type: "completed", text: "Local reply", inputTokens: 2, outputTokens: 1 };
      }
    };
    const service = new ModelGatewayService({ local: blockingProvider, mock: provider({ events: [{ type: "completed", text: "Mock reply" }] }) });

    const requests = [service.generate(request), service.generate(request), service.generate(request)];
    await twoEntered;
    expect(active).toBe(2);
    expect(peakActive).toBe(2);

    release?.();
    const results = await Promise.all(requests);
    expect(results).toHaveLength(3);
    expect(peakActive).toBe(2);
  });

  it("does not silently create a Mock fallback when beta disables it", async () => {
    const service = new ModelGatewayService({ local: provider({ available: false }) }, false);
    await expect(service.generate(request)).rejects.toMatchObject({ status: 503 });
  });
});
