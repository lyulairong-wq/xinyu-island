import { describe, expect, it, vi } from "vitest";
import { ModelGatewayService } from "../model-gateway/model-gateway.service";
import { ChatGenerationCoordinator } from "./chat-generation-coordinator";
import { GenerationPolicy } from "./generation-policy";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("ChatGenerationCoordinator Mock fallback", () => {
  it("completes a normal Chinese greeting through the gateway with provider=mock", async () => {
    let messageSequence = 0;
    const createMessage = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `message-${++messageSequence}`,
      ...data,
      createdAt: new Date()
    }));
    const prisma = {
      conversation: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => ({ id: "conversation-1" })) },
      message: { create: createMessage }
    };
    const transaction = {
      conversation: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => ({ id: "conversation-1" })) },
      message: { create: createMessage }
    };
    const reservation = {
      id: "reservation-1",
      userId: "user-1",
      conversationId: "conversation-1",
      requestId: REQUEST_ID,
      mode: "free",
      status: "reserved",
      provider: null,
      reservedTokens: 513,
      completedAt: null,
      estimatedInputTokens: 1,
      estimatedOutputTokens: 512
    };
    const usage = {
      reserveFree: vi.fn(async () => reservation),
      finalizeFreeWithMessage: vi.fn(async (
        _reservation: typeof reservation,
        _actual: { provider: string; inputTokens: number; outputTokens: number },
        persist: (client: typeof transaction) => Promise<{ messageId: string; result: unknown }>
      ) => (await persist(transaction)).result),
      releaseFree: vi.fn(async () => undefined)
    };
    const coordinator = new ChatGenerationCoordinator(
      prisma as never,
      usage as never,
      new ModelGatewayService(),
      new GenerationPolicy()
    );

    const result = await coordinator.generate({
      userId: "user-1",
      conversationId: "conversation-1",
      requestId: REQUEST_ID,
      kind: "single",
      mode: "free",
      content: "你好",
      contacts: [{ name: "林屿", systemPrompt: "陪伴提示" }],
      maxInputCharacters: 2_000,
      maxOutputTokens: 512
    });

    expect(result).toMatchObject({ provider: "mock", degraded: true });
    expect("assistantMessage" in result && result.assistantMessage.content).toContain("你好");
    expect("assistantMessage" in result && result.assistantMessage.content).not.toMatch(/\p{Script=Latin}/u);
    expect(usage.releaseFree).not.toHaveBeenCalled();
  });
});
