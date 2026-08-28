import { BadRequestException } from "@nestjs/common";
import type { SkillCode } from "@xinyu/contracts";
import { validate } from "class-validator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatGenerationCoordinator } from "../chat/chat-generation-coordinator";
import { GenerationPolicy } from "../chat/generation-policy";
import type { ModelGatewayResult } from "../model-gateway/model-gateway.service";
import { StartSkillSessionDto } from "./dto/start-skill-session.dto";
import { SkillCatalog } from "./skill-catalog";
import { SkillSessionService } from "./skill-session.service";

const USER_ID = "user-1";
const CONVERSATION_ID = "conversation-1";
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

type ConversationFixture = {
  id: string;
  userId: string;
  contactId: string;
  kind: "single" | "group";
  memoryEnabled: boolean;
  members: Array<{ contactId: string; sortOrder: number }>;
};

const contactFixtures: Record<string, {
  id: string;
  name: string;
  tone: string;
  description: string;
  skills: SkillCode[];
}> = {
  hui: { id: "hui", name: "绘", tone: "感性而克制", description: "叙事解读者", skills: ["tarot"] },
  lan: { id: "lan", name: "岚", tone: "温和", description: "通用陪伴者", skills: [] },
  yan: { id: "yan", name: "砚", tone: "沉静而克制", description: "东方意象解读者", skills: ["ziwei"] }
};

function singleConversation(contactId = "hui"): ConversationFixture {
  return {
    id: CONVERSATION_ID,
    userId: USER_ID,
    contactId,
    kind: "single",
    memoryEnabled: false,
    members: []
  };
}

function groupConversation(): ConversationFixture {
  return {
    id: CONVERSATION_ID,
    userId: USER_ID,
    contactId: "hui",
    kind: "group",
    memoryEnabled: false,
    members: [
      { contactId: "hui", sortOrder: 0 },
      { contactId: "lan", sortOrder: 1 }
    ]
  };
}

function createHarness(conversation: ConversationFixture = singleConversation()) {
  const messages: Array<Record<string, unknown>> = [];
  const completedRequestIds = new Set<string>();
  let messageSequence = 0;
  const createMessage = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    messageSequence += 1;
    const message = { id: `message-${messageSequence}`, ...data, createdAt: new Date() };
    messages.push(message);
    return message;
  });
  const prisma = {
    conversation: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === conversation.id && where.userId === conversation.userId ? conversation : null)
    },
    contactMemory: {
      findMany: vi.fn(async () => [])
    },
    message: { create: createMessage }
  };
  const transaction = {
    conversation: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === conversation.id && where.userId === conversation.userId ? conversation : null)
    },
    message: { create: createMessage }
  };
  const reservation = {
    id: "reservation-1",
    userId: USER_ID,
    conversationId: CONVERSATION_ID,
    requestId: REQUEST_ID,
    mode: "free",
    status: "reserved",
    provider: null,
    reservedTokens: 513,
    completedAt: null,
    estimatedInputTokens: 1,
    estimatedOutputTokens: 512
  };
  const usage: any = {
    reserveFree: vi.fn(async (_userId: string, requestId: string) => {
      if (completedRequestIds.has(requestId)) {
        throw new BadRequestException({ code: "FREE_GENERATION_IN_PROGRESS" });
      }
      completedRequestIds.add(requestId);
      return { ...reservation, requestId };
    }),
    finalizeFreeWithMessage: vi.fn(async (
      _reservation: typeof reservation,
      _actual: unknown,
      persist: (client: typeof transaction) => Promise<{ result: unknown }>
    ) => (await persist(transaction)).result),
    releaseFree: vi.fn(async () => undefined),
    settleSimulatedTokenWithMessages: vi.fn()
  };
  const gateway = {
    generate: vi.fn(async () => ({
      text: "这张牌可以当作一面温和的镜子，看看你此刻最在意的感受。",
      provider: "primary" as ModelGatewayResult["provider"],
      degraded: false,
      inputTokens: 8,
      outputTokens: 16
    }))
  };
  const contacts = {
    resolve: vi.fn(async (_userId: string, contactId: string) => contactFixtures[contactId]),
    createMemory: vi.fn(async (_userId: string, contactId: string, input: { fact: string; sensitivity: string }) => ({
      id: "memory-1",
      userId: USER_ID,
      contactId,
      fact: input.fact.trim(),
      sensitivity: input.sensitivity,
      source: "user_explicit"
    }))
  };
  const coordinator = new ChatGenerationCoordinator(
    prisma as never,
    usage as never,
    gateway as never,
    new GenerationPolicy()
  );
  const generate = vi.spyOn(coordinator, "generate");
  const sessions = new SkillSessionService(
    prisma as never,
    contacts as never,
    coordinator,
    new SkillCatalog()
  );

  return { contacts, gateway, generate, messages, prisma, sessions, usage };
}

function tarotInput(overrides: Partial<StartSkillSessionDto> = {}): StartSkillSessionDto {
  return {
    skill: "tarot",
    topic: "最近的感受",
    mode: "free",
    requestId: REQUEST_ID,
    ...overrides
  };
}

describe("StartSkillSessionDto", () => {
  it("rejects an unknown skill and a non-UUID request id", async () => {
    const input = Object.assign(new StartSkillSessionDto(), {
      skill: "unknown",
      mode: "free",
      requestId: "request-1"
    });

    const errors = await validate(input);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["skill", "requestId"]));
  });
});

describe("SkillSessionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/xinyu-test");
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-at-least-32-characters");
    vi.stubEnv("FREE_MAX_INPUT_CHARS", "2000");
    vi.stubEnv("FREE_MAX_OUTPUT_TOKENS", "512");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns one tarot card and persists it only on the safe assistant message", async () => {
    const { contacts, generate, messages, sessions, usage } = createHarness();

    const result = await sessions.start(USER_ID, CONVERSATION_ID, tarotInput());

    expect(result).toMatchObject({
      mode: "free",
      chargedTokens: 0,
      skillCard: {
        skill: "tarot",
        title: "塔罗",
        disclaimer: "趣味解读，仅供娱乐参考",
        actions: ["deepen", "change_topic", "return_to_chat"]
      },
      assistantMessage: {
        role: "assistant",
        metadata: {
          skillCard: {
            skill: "tarot",
            disclaimer: "趣味解读，仅供娱乐参考"
          }
        }
      }
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "user",
      content: "我想体验一次塔罗趣味解读。",
    });
    expect(JSON.stringify(messages[0])).not.toContain("最近的感受");
    expect(JSON.stringify(messages[0])).not.toContain("玩法边界");
    expect(messages[0]).not.toHaveProperty("metadata");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(usage.reserveFree).toHaveBeenCalledTimes(1);
    expect(usage.finalizeFreeWithMessage).toHaveBeenCalledTimes(1);
    expect(contacts.createMemory).not.toHaveBeenCalled();
  });

  it("does not start a skill or persist messages while beta generation is paused", async () => {
    vi.stubEnv("BETA_GENERATION_ENABLED", "false");
    const { generate, messages, sessions, usage } = createHarness();

    await expect(sessions.start(USER_ID, CONVERSATION_ID, tarotInput())).rejects.toMatchObject({
      response: { code: "BETA_GENERATION_PAUSED" }
    });
    expect(generate).not.toHaveBeenCalled();
    expect(usage.reserveFree).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });

  it("does not allow the simulated token skill path when beta token mode is disabled", async () => {
    vi.stubEnv("BETA_TOKEN_MODE_ENABLED", "false");
    const { generate, messages, sessions } = createHarness();

    await expect(sessions.start(USER_ID, CONVERSATION_ID, tarotInput({ mode: "token" }))).rejects.toMatchObject({
      response: { code: "BETA_TOKEN_MODE_DISABLED" }
    });
    expect(generate).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });

  it("rejects high-risk medical-decision input before generation and creates no card", async () => {
    const { gateway, generate, messages, sessions, usage } = createHarness();

    await expect(sessions.start(USER_ID, CONVERSATION_ID, tarotInput({
      topic: "该不该自行停药"
    }))).rejects.toMatchObject({ response: { code: "GENERATION_SAFETY_REJECTED" } });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(gateway.generate).not.toHaveBeenCalled();
    expect(usage.reserveFree).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });

  it("rejects a skill that is not mounted on the active contact", async () => {
    const { generate, sessions } = createHarness(singleConversation("lan"));

    await expect(sessions.start(USER_ID, CONVERSATION_ID, tarotInput())).rejects.toMatchObject({
      response: { code: "SKILL_NOT_MOUNTED" }
    });

    expect(generate).not.toHaveBeenCalled();
  });

  it("requires a group target and verifies that target is a member with the selected skill", async () => {
    const { generate, sessions } = createHarness(groupConversation());

    await expect(sessions.start(USER_ID, CONVERSATION_ID, tarotInput())).rejects.toMatchObject({
      response: { code: "SKILL_GROUP_TARGET_REQUIRED" }
    });
    await expect(sessions.start(USER_ID, CONVERSATION_ID, tarotInput({ targetContactId: "missing" }))).rejects.toMatchObject({
      response: { code: "SKILL_CONTACT_NOT_ELIGIBLE" }
    });
    await expect(sessions.start(USER_ID, CONVERSATION_ID, tarotInput({ targetContactId: "lan" }))).rejects.toMatchObject({
      response: { code: "SKILL_NOT_MOUNTED" }
    });

    expect(generate).not.toHaveBeenCalled();
  });

  it("returns an ordinary-chat fallback for incomplete ziwei input without generation or billing", async () => {
    const { generate, sessions, usage } = createHarness(singleConversation("yan"));

    const result = await sessions.start(USER_ID, CONVERSATION_ID, {
      skill: "ziwei",
      birthDate: "2001-01-01",
      mode: "free",
      requestId: REQUEST_ID
    });

    expect(result).toEqual({
      state: "fallback",
      fallback: "ordinary_chat",
      missingInputs: ["topic"],
      mode: "free",
      chargedTokens: 0
    });
    expect(generate).not.toHaveBeenCalled();
    expect(usage.reserveFree).not.toHaveBeenCalled();
  });

  it("reuses the request id so a retry cannot generate, persist, or settle twice", async () => {
    const { gateway, messages, sessions, usage } = createHarness();
    const input = tarotInput();

    await sessions.start(USER_ID, CONVERSATION_ID, input);
    await expect(sessions.start(USER_ID, CONVERSATION_ID, input)).rejects.toMatchObject({
      response: { code: "FREE_GENERATION_IN_PROGRESS" }
    });

    expect(gateway.generate).toHaveBeenCalledTimes(1);
    expect(usage.finalizeFreeWithMessage).toHaveBeenCalledTimes(1);
    expect(messages).toHaveLength(2);
  });

  it("does not copy raw ziwei birth input into card metadata", async () => {
    const { messages, sessions } = createHarness(singleConversation("yan"));

    const result = await sessions.start(USER_ID, CONVERSATION_ID, {
      skill: "ziwei",
      topic: "未来方向",
      birthDate: "2001-01-01",
      birthTimePeriod: "子时",
      mode: "free",
      requestId: REQUEST_ID
    });

    if (!("assistantMessage" in result)) throw new Error("Expected a completed skill session");
    const metadata = JSON.stringify(result.assistantMessage.metadata);
    expect(metadata).not.toContain("2001-01-01");
    expect(metadata).not.toContain("子时");
    expect(JSON.stringify(messages[1]?.metadata)).toBe(metadata);
    expect(messages[0]).toMatchObject({
      role: "user",
      content: "我想体验一次紫微斗数趣味解读。",
    });
    expect(JSON.stringify(messages[0])).not.toContain("2001-01-01");
    expect(JSON.stringify(messages[0])).not.toContain("子时");
  });

  it("writes only a user-selected fact through the explicit contact-memory action", async () => {
    const { contacts, sessions } = createHarness(singleConversation("yan"));

    const result = await sessions.remember(USER_ID, CONVERSATION_ID, "yan", {
      fact: "  我希望以后被提醒多休息  ",
      sensitivity: "normal"
    });

    expect(contacts.createMemory).toHaveBeenCalledWith(USER_ID, "yan", {
      fact: "  我希望以后被提醒多休息  ",
      sensitivity: "normal"
    });
    expect(result).toMatchObject({ contactId: "yan", fact: "我希望以后被提醒多休息", source: "user_explicit" });
  });
});
