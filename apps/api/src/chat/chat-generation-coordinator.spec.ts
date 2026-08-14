import { BadRequestException } from "@nestjs/common";
import type { GenerationRequest } from "@xinyu/ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelGatewayResult } from "../model-gateway/model-gateway.service";
import { ChatGenerationCoordinator, type ChatGenerationInput } from "./chat-generation-coordinator";
import { GenerationPolicy } from "./generation-policy";

const controlledMock = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; request: GenerationRequest }>,
  created: [] as string[],
  replies: [] as string[]
}));

vi.mock("@xinyu/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xinyu/ai")>();

  class ControlledMockAiProvider {
    constructor(private readonly name = "心屿 AI") {
      controlledMock.created.push(name);
    }

    async *generate(request: GenerationRequest) {
      controlledMock.calls.push({ name: this.name, request });
      const text = controlledMock.replies.shift() ?? `${this.name}回复`;
      yield { type: "started" as const, provider: "mock" };
      yield { type: "delta" as const, text, provider: "mock" };
      yield { type: "completed" as const, text, provider: "mock" };
    }

    async healthCheck() {
      return { available: true };
    }
  }

  return { ...actual, MockAiProvider: ControlledMockAiProvider };
});

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function input(overrides: Partial<ChatGenerationInput> = {}): ChatGenerationInput {
  return {
    userId: "user-1",
    conversationId: "conversation-1",
    requestId: REQUEST_ID,
    kind: "single",
    mode: "free",
    content: "你好",
    contacts: [{ name: "林屿", systemPrompt: "陪伴提示" }],
    maxInputCharacters: 2_000,
    maxOutputTokens: 512,
    ...overrides
  };
}

function createHarness() {
  let userSequence = 0;
  let assistantSequence = 0;
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
  const prisma = {
    message: {
      create: vi.fn(async ({ data }: { data: { role: string; content: string; mode: string; quotedMessageId?: string } }) => {
        if (data.role !== "user") throw new Error("assistant write bypassed settlement");
        userSequence += 1;
        return { id: `user-${userSequence}`, ...data, createdAt: new Date() };
      })
    }
  };
  const transaction = {
    message: {
      create: vi.fn(async ({ data }: { data: { role: string; content: string; mode: string } }) => {
        if (data.role === "user") {
          userSequence += 1;
          return { id: `user-${userSequence}`, ...data, createdAt: new Date() };
        }
        if (data.role === "assistant") {
          assistantSequence += 1;
          return { id: `assistant-${assistantSequence}`, ...data, createdAt: new Date() };
        }
        throw new Error("unexpected transaction message role");
      })
    }
  };
  const usage: any = {
    reserveFree: vi.fn(async () => reservation),
    finalizeFreeWithMessage: vi.fn(),
    releaseFree: vi.fn(async () => undefined),
    settleSimulatedTokenWithMessages: vi.fn()
  };
  usage.finalizeFreeWithMessage.mockImplementation(async (
    _reservation: typeof reservation,
    _actual: { provider: string; inputTokens: number; outputTokens: number },
    persist: (tx: typeof transaction) => Promise<{ messageId: string; result: unknown }>
  ) => (await persist(transaction)).result);
  usage.settleSimulatedTokenWithMessages.mockImplementation(async (
    _userId: string,
    _actual: { conversationId: string; requestId: string },
    persist: (tx: typeof transaction) => Promise<{ messageId: string; provider: string; inputTokens: number; outputTokens: number; result: unknown }>
  ) => (await persist(transaction)).result);
  const gateway = {
    generate: vi.fn(async () => ({
      text: "林屿回复",
      provider: "primary" as ModelGatewayResult["provider"],
      degraded: false,
      inputTokens: 2,
      outputTokens: 4
    }))
  };
  const coordinator = new ChatGenerationCoordinator(
    prisma as never,
    usage as never,
    gateway as never,
    new GenerationPolicy()
  );

  return { coordinator, gateway, prisma, reservation, transaction, usage };
}

function expectBadRequestCode(promise: Promise<unknown>, code: string) {
  return expect(promise).rejects.toSatisfy((error: unknown) => {
    if (!(error instanceof BadRequestException)) return false;
    const response = error.getResponse();
    return typeof response === "object" && response !== null && "code" in response && response.code === code;
  });
}

describe("ChatGenerationCoordinator", () => {
  beforeEach(() => {
    controlledMock.calls = [];
    controlledMock.created = [];
    controlledMock.replies = [];
  });

  it.each([
    ["free", "Quoted message in English"],
    ["token", "𝖧arm myself tonight. 好"]
  ] as const)("rejects an invalid %s quote before writes, quota, or providers", async (mode, quoteContent) => {
    const { coordinator, gateway, prisma, transaction, usage } = createHarness();

    await expectBadRequestCode(coordinator.generate(input({
      mode,
      quote: { id: "quoted-1", content: quoteContent }
    })), "GENERATION_QUOTE_REJECTED");

    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(transaction.message.create).not.toHaveBeenCalled();
    expect(usage.reserveFree).not.toHaveBeenCalled();
    expect(usage.finalizeFreeWithMessage).not.toHaveBeenCalled();
    expect(usage.settleSimulatedTokenWithMessages).not.toHaveBeenCalled();
    expect(gateway.generate).not.toHaveBeenCalled();
    expect(controlledMock.created).toEqual([]);
    expect(controlledMock.calls).toEqual([]);
  });

  it.each(["free", "token"] as const)("normalizes Chinese input with digits and emoji before %s generation", async (mode) => {
    const { coordinator, gateway, prisma, transaction } = createHarness();
    controlledMock.replies = ["模拟回复"];

    const result = await coordinator.generate(input({ mode, content: "今天\u200B完成了１２件事🙂" }));

    expect(result).toMatchObject({ mode });
    const createMessage = mode === "free" ? prisma.message.create : transaction.message.create;
    expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "user", content: "今天完成了12件事🙂", mode })
    }));
    if (mode === "free") {
      expect(gateway.generate).toHaveBeenCalledWith(expect.objectContaining({ content: "今天完成了12件事🙂", mode }));
    } else {
      expect(controlledMock.calls[0]?.request).toEqual(expect.objectContaining({ content: "今天完成了12件事🙂", mode }));
    }
  });

  it("uses Mock only and atomically settles one Token single-chat reply", async () => {
    const { coordinator, gateway, transaction, usage } = createHarness();
    controlledMock.replies = ["模拟回复"];

    const result = await coordinator.generate(input({ mode: "token" }));

    expect(gateway.generate).not.toHaveBeenCalled();
    expect(controlledMock.created).toEqual(["林屿"]);
    expect(controlledMock.calls).toHaveLength(1);
    expect(usage.settleSimulatedTokenWithMessages).toHaveBeenCalledWith("user-1", {
      conversationId: "conversation-1",
      requestId: REQUEST_ID
    }, expect.any(Function));
    expect(usage.settleSimulatedTokenWithMessages).toHaveBeenCalledTimes(1);
    expect(transaction.message.create.mock.calls.map(([call]) => call.data.content)).toEqual(["你好", "模拟回复"]);
    expect(result).toMatchObject({ mode: "token", assistantMessage: { content: "模拟回复" } });
  });

  it("collects Token group replies in member order before one simulated settlement", async () => {
    const { coordinator, gateway, transaction, usage } = createHarness();
    controlledMock.replies = ["林屿回复", "星河回复"];

    const result = await coordinator.generate(input({
      kind: "group",
      mode: "token",
      contacts: [
        { name: "林屿", systemPrompt: "林屿提示" },
        { name: "星河", systemPrompt: "星河提示" }
      ]
    }));

    expect(gateway.generate).not.toHaveBeenCalled();
    expect(controlledMock.created).toEqual(["林屿", "星河"]);
    expect(controlledMock.calls.map(({ name }) => name)).toEqual(["林屿", "星河"]);
    expect(usage.settleSimulatedTokenWithMessages).toHaveBeenCalledTimes(1);
    expect(transaction.message.create.mock.calls.map(([call]) => call.data.content)).toEqual(["你好", "林屿回复", "星河回复"]);
    expect(result).toMatchObject({ mode: "token" });
    expect("assistantMessages" in result && result.assistantMessages.map((message) => message.content)).toEqual(["林屿回复", "星河回复"]);
  });

  it("releases a Free reservation and persists no assistant when output is rejected", async () => {
    const { coordinator, gateway, prisma, reservation, transaction, usage } = createHarness();
    gateway.generate.mockResolvedValueOnce({
      text: "Rejected output 啊",
      provider: "local",
      degraded: false,
      inputTokens: 2,
      outputTokens: 4
    });

    await expectBadRequestCode(coordinator.generate(input()), "GENERATION_OUTPUT_REJECTED");

    expect(prisma.message.create.mock.calls.map(([call]) => call.data.role)).toEqual(["user"]);
    expect(transaction.message.create).not.toHaveBeenCalled();
    expect(usage.finalizeFreeWithMessage).not.toHaveBeenCalled();
    expect(usage.releaseFree).toHaveBeenCalledWith(reservation);
  });

  it("does not settle or persist any Token group reply when one Mock output is rejected", async () => {
    const { coordinator, gateway, prisma, transaction, usage } = createHarness();
    controlledMock.replies = ["林屿回复", "Rejected reply 啊"];

    await expectBadRequestCode(coordinator.generate(input({
      kind: "group",
      mode: "token",
      contacts: [
        { name: "林屿", systemPrompt: "林屿提示" },
        { name: "星河", systemPrompt: "星河提示" }
      ]
    })), "GENERATION_OUTPUT_REJECTED");

    expect(gateway.generate).not.toHaveBeenCalled();
    expect(controlledMock.calls).toHaveLength(2);
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(transaction.message.create).not.toHaveBeenCalled();
    expect(usage.settleSimulatedTokenWithMessages).toHaveBeenCalledTimes(1);
  });
});
