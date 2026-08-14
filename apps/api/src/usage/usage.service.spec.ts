import { afterEach, describe, expect, it, vi } from "vitest";
import { UsageService } from "./usage.service";

type Account = {
  id: string;
  userId: string;
  freeLimit: number;
  freeUsed: number;
  freeResetAt: Date;
  paidBalance: number;
};

type Request = {
  id: string;
  userId: string;
  conversationId: string;
  requestId: string;
  mode: string;
  status: string;
  provider: string | null;
  reservedTokens: number;
  completedAt: Date | null;
};

type UsageRecord = {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  generationRequestId: string | null;
  mode: string;
  bucket: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  source: string;
  createdAt: Date;
};

type State = {
  account: Account | null;
  requests: Request[];
  records: UsageRecord[];
  messages: Array<{ id: string; content: string }>;
};

function createUsagePrisma(account?: Partial<Account>, options: { failUsageRecordCreate?: boolean } = {}) {
  const state: State = {
    account: {
      id: "account-1",
      userId: "user-1",
      freeLimit: 6_000,
      freeUsed: 0,
      freeResetAt: new Date("2026-08-10T16:00:00.000Z"),
      paidBalance: 50,
      ...account
    },
    requests: [],
    records: [],
    messages: []
  };
  let nextRequestId = 1;
  let nextRecordId = 1;
  let transactionTail = Promise.resolve();

  const makeClient = (current: State) => ({
    tokenAccount: {
      upsert: vi.fn(async ({ create, update }: { create: Pick<Account, "userId" | "freeLimit" | "freeResetAt">; update: Partial<Account> }) => {
        current.account ??= { id: "account-1", freeUsed: 0, paidBalance: 0, ...create };
        Object.assign(current.account, update);
        return current.account;
      }),
      update: vi.fn(async ({ data }: { data: { freeUsed?: number | { increment?: number; decrement?: number }; freeResetAt?: Date; paidBalance?: { decrement?: number } } }) => {
        if (!current.account) throw new Error("Missing token account");
        if (typeof data.freeUsed === "number") current.account.freeUsed = data.freeUsed;
        if (typeof data.freeUsed === "object") {
          current.account.freeUsed += data.freeUsed.increment ?? 0;
          current.account.freeUsed -= data.freeUsed.decrement ?? 0;
        }
        if (data.freeResetAt) current.account.freeResetAt = data.freeResetAt;
        current.account.paidBalance -= data.paidBalance?.decrement ?? 0;
        return current.account;
      })
    },
    generationRequest: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; userId_requestId?: { userId: string; requestId: string } } }) =>
        current.requests.find((request) =>
          where.id ? request.id === where.id : request.userId === where.userId_requestId?.userId && request.requestId === where.userId_requestId.requestId
        ) ?? null
      ),
      findFirst: vi.fn(async ({ where }: { where: { userId: string; status: string; completedAt?: { gt: Date } } }) =>
        current.requests.find((request) =>
          request.userId === where.userId && request.status === where.status && (!where.completedAt || (request.completedAt?.getTime() ?? 0) > where.completedAt.gt.getTime())
        ) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<Request, "id" | "provider" | "completedAt"> }) => {
        if (current.requests.some((request) => request.userId === data.userId && request.requestId === data.requestId)) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        const request = { id: `generation-${nextRequestId++}`, provider: null, completedAt: null, ...data };
        current.requests.push(request);
        return request;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Request> }) => {
        const request = current.requests.find((candidate) => candidate.id === where.id);
        if (!request) throw new Error("Missing generation request");
        Object.assign(request, data);
        return request;
      })
    },
    tokenUsageRecord: {
      findUnique: vi.fn(async ({ where }: { where: { generationRequestId: string } }) =>
        current.records.find((record) => record.generationRequestId === where.generationRequestId) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<UsageRecord, "id" | "createdAt"> }) => {
        if (options.failUsageRecordCreate) throw new Error("usage record write failed");
        if (current.records.some((record) => record.generationRequestId === data.generationRequestId)) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        const record = { id: `usage-${nextRecordId++}`, createdAt: new Date(), ...data };
        current.records.push(record);
        return record;
      }),
      findMany: vi.fn(async () => current.records)
    },
    message: {
      create: vi.fn(async ({ data }: { data: { content: string } }) => {
        const message = { id: `message-${current.messages.length + 1}`, content: data.content };
        current.messages.push(message);
        return message;
      })
    }
  });

  const prisma = makeClient(state) as ReturnType<typeof makeClient> & {
    $transaction: <T>(callback: (transaction: ReturnType<typeof makeClient>) => Promise<T>, options?: { isolationLevel?: string }) => Promise<T>;
    state: State;
  };

  prisma.$transaction = async <T>(callback: (transaction: ReturnType<typeof makeClient>) => Promise<T>) => {
    let release: () => void = () => undefined;
    const previous = transactionTail;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const draft = structuredClone(state);
    try {
      const result = await callback(makeClient(draft));
      state.account = draft.account;
      state.requests = draft.requests;
      state.records = draft.records;
      state.messages = draft.messages;
      return result;
    } finally {
      release();
    }
  };
  prisma.state = state;
  return prisma;
}

const estimate = (tokens: number, conversationId = "conversation-1") => ({
  conversationId,
  inputTokens: tokens,
  outputTokens: 0
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("UsageService free generation accounting", () => {
  it("rejects a reservation that would exceed the 6,000-token daily limit", async () => {
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma({ freeLimit: 10_000, freeUsed: 5_900 });
    const service = new UsageService(prisma as never);

    await expect(service.reserveFree("user-1", "request-1", estimate(101))).rejects.toMatchObject({
      response: { code: "FREE_QUOTA_EXCEEDED" }
    });
    expect(prisma.state.account?.freeLimit).toBe(10_000);
    expect(prisma.state.account?.freeUsed).toBe(5_900);
    expect(prisma.state.requests).toHaveLength(0);
  });

  it("resets usage at Beijing midnight and schedules the next Beijing midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T15:59:59.999Z"));
    const prisma = createUsagePrisma({ freeUsed: 6_000, freeResetAt: new Date("2026-08-09T16:00:00.000Z") });
    const service = new UsageService(prisma as never);

    await expect(service.reserveFree("user-1", "before-midnight", estimate(1))).rejects.toMatchObject({
      response: { code: "FREE_QUOTA_EXCEEDED" }
    });

    vi.setSystemTime(new Date("2026-08-09T16:00:00.000Z"));
    await service.reserveFree("user-1", "at-midnight", estimate(1));

    expect(prisma.state.account?.freeUsed).toBe(1);
    expect(prisma.state.account?.freeResetAt).toEqual(new Date("2026-08-10T16:00:00.000Z"));
  });

  it("rejects a duplicate client request id without charging twice", async () => {
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma();
    const service = new UsageService(prisma as never);

    await service.reserveFree("user-1", "request-1", estimate(250));
    await expect(service.reserveFree("user-1", "request-1", estimate(250))).rejects.toMatchObject({
      response: { code: "FREE_GENERATION_IN_PROGRESS" }
    });

    expect(prisma.state.account?.freeUsed).toBe(250);
    expect(prisma.state.requests).toHaveLength(1);
  });

  it("allows only one concurrent reservation for a user", async () => {
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma();
    const service = new UsageService(prisma as never);

    const results = await Promise.allSettled([
      service.reserveFree("user-1", "request-1", estimate(200)),
      service.reserveFree("user-1", "request-2", estimate(200))
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")[0]).toMatchObject({
      reason: { response: { code: "FREE_GENERATION_IN_PROGRESS" } }
    });
    expect(prisma.state.account?.freeUsed).toBe(200);
    expect(prisma.state.requests).toHaveLength(1);
  });

  it("enforces a three-second cooldown after completion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma();
    const service = new UsageService(prisma as never);
    const reservation = await service.reserveFree("user-1", "request-1", estimate(100));
    await service.finalizeFree(reservation, { provider: "local" });

    vi.advanceTimersByTime(2_999);
    await expect(service.reserveFree("user-1", "request-2", estimate(100))).rejects.toMatchObject({
      response: { code: "FREE_COOLDOWN_ACTIVE" }
    });

    vi.advanceTimersByTime(1);
    await expect(service.reserveFree("user-1", "request-2", estimate(100))).resolves.toMatchObject({ status: "reserved" });
  });

  it("releases a failed Provider reservation without creating usage", async () => {
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma({ freeUsed: 20 });
    const service = new UsageService(prisma as never);
    const reservation = await service.reserveFree("user-1", "request-1", estimate(500));

    await service.releaseFree(reservation);

    expect(prisma.state.account?.freeUsed).toBe(20);
    expect(prisma.state.requests[0]).toMatchObject({ status: "failed", completedAt: null });
    expect(prisma.state.records).toHaveLength(0);
    await expect(service.reserveFree("user-1", "request-2", estimate(500))).resolves.toMatchObject({ status: "reserved" });
  });

  it("rolls back assistant persistence and the reservation when free finalization cannot create usage", async () => {
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma(undefined, { failUsageRecordCreate: true });
    const service = new UsageService(prisma as never);
    const reservation = await service.reserveFree("user-1", "request-1", estimate(500));

    await expect(service.finalizeFreeWithMessage(reservation, { provider: "local", inputTokens: 120, outputTokens: 80 }, async (transaction) => {
      const message = await transaction.message.create({ data: { conversationId: "conversation-1", role: "assistant", content: "assistant reply", mode: "free" } });
      return { messageId: message.id, result: message };
    })).rejects.toThrow("usage record write failed");

    expect(prisma.state.messages).toEqual([]);
    expect(prisma.state.records).toEqual([]);
    expect(prisma.state.requests).toMatchObject([{ status: "reserved" }]);
    expect(prisma.state.account?.freeUsed).toBe(500);
  });

  it("reconciles Provider usage exactly and creates one idempotent usage record", async () => {
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma();
    const service = new UsageService(prisma as never);
    const reservation = await service.reserveFree("user-1", "request-1", {
      conversationId: "conversation-1",
      inputTokens: 300,
      outputTokens: 200
    });

    const first = await service.finalizeFree(reservation, { provider: "local", inputTokens: 120, outputTokens: 80 });
    const second = await service.finalizeFree(reservation, { provider: "local", inputTokens: 120, outputTokens: 80 });

    expect(first).toMatchObject({
      generationRequestId: reservation.id,
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      source: "provider"
    });
    expect(second).toEqual(first);
    expect(prisma.state.account?.freeUsed).toBe(200);
    expect(prisma.state.records).toHaveLength(1);
  });

  it("records the reserved estimate when the Provider omits token usage", async () => {
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    const prisma = createUsagePrisma();
    const service = new UsageService(prisma as never);
    const reservation = await service.reserveFree("user-1", "request-1", estimate(500));

    const record = await service.finalizeFree(reservation, { provider: "local" });

    expect(record).toMatchObject({ inputTokens: 500, outputTokens: 0, totalTokens: 500, source: "estimated" });
    expect(prisma.state.account?.freeUsed).toBe(500);
  });
});

describe("UsageService simulated token settlement", () => {
  it("generates and debits only once when a completed Token request is retried", async () => {
    const prisma = createUsagePrisma({ paidBalance: 50 });
    const service = new UsageService(prisma as never);
    let generationCalls = 0;
    const settle = () => service.settleSimulatedTokenWithMessages("user-1", {
      conversationId: "conversation-1",
      requestId: "request-1"
    }, async (transaction) => {
      generationCalls += 1;
      const userMessage = await transaction.message.create({
        data: { conversationId: "conversation-1", role: "user", content: "你好", mode: "token" }
      });
      const assistantMessage = await transaction.message.create({
        data: { conversationId: "conversation-1", role: "assistant", content: "你好呀", mode: "token" }
      });
      return {
        messageId: assistantMessage.id,
        provider: "mock",
        inputTokens: 20,
        outputTokens: 10,
        result: { userMessage, assistantMessage }
      };
    });

    await expect(settle()).resolves.toMatchObject({ assistantMessage: { content: "你好呀" } });
    await expect(settle()).rejects.toMatchObject({
      response: { code: "GENERATION_ALREADY_COMPLETED" },
      status: 409
    });

    expect(generationCalls).toBe(1);
    expect(prisma.state.account?.paidBalance).toBe(20);
    expect(prisma.state.messages).toHaveLength(2);
    expect(prisma.state.requests).toMatchObject([{
      userId: "user-1",
      conversationId: "conversation-1",
      requestId: "request-1",
      mode: "token",
      status: "completed",
      provider: "mock",
      reservedTokens: 0,
      completedAt: expect.any(Date)
    }]);
    expect(prisma.state.records).toMatchObject([{
      generationRequestId: prisma.state.requests[0]!.id,
      totalTokens: 30,
      source: "simulated"
    }]);
  });

  it("rolls back persisted reply, paid balance, and usage when persistence throws", async () => {
    const prisma = createUsagePrisma({ paidBalance: 50 });
    const service = new UsageService(prisma as never);

    await expect(service.settleSimulatedTokenWithMessages("user-1", {
      conversationId: "conversation-1",
      requestId: "request-1"
    }, async (transaction) => {
      await transaction.message.create({ data: { conversationId: "conversation-1", role: "user", content: "你好", mode: "token" } });
      await transaction.message.create({ data: { conversationId: "conversation-1", role: "assistant", content: "你好呀", mode: "token" } });
      throw new Error("message persistence failed");
    })).rejects.toThrow("message persistence failed");

    expect(prisma.state.messages).toEqual([]);
    expect(prisma.state.account?.paidBalance).toBe(50);
    expect(prisma.state.records).toEqual([]);
    expect(prisma.state.requests).toEqual([]);
  });

  it("rolls back the Token request, both messages, balance, and usage when usage persistence fails", async () => {
    const prisma = createUsagePrisma({ paidBalance: 50 }, { failUsageRecordCreate: true });
    const service = new UsageService(prisma as never);

    await expect(service.settleSimulatedTokenWithMessages("user-1", {
      conversationId: "conversation-1",
      requestId: "request-1"
    }, async (transaction) => {
      const userMessage = await transaction.message.create({
        data: { conversationId: "conversation-1", role: "user", content: "你好", mode: "token" }
      });
      const assistantMessage = await transaction.message.create({
        data: { conversationId: "conversation-1", role: "assistant", content: "你好呀", mode: "token" }
      });
      return {
        messageId: assistantMessage.id,
        provider: "mock",
        inputTokens: 20,
        outputTokens: 10,
        result: { userMessage, assistantMessage }
      };
    })).rejects.toThrow("usage record write failed");

    expect(prisma.state).toMatchObject({ requests: [], messages: [], records: [] });
    expect(prisma.state.account?.paidBalance).toBe(50);
  });

  it("persists a simulated token reply, deducts its balance, and records paid usage", async () => {
    const prisma = createUsagePrisma({ paidBalance: 50 });
    const service = new UsageService(prisma as never);

    const result = await service.settleSimulatedTokenWithMessages("user-1", {
      conversationId: "conversation-1",
      requestId: "request-1"
    }, async (transaction) => {
      await transaction.message.create({ data: { conversationId: "conversation-1", role: "user", content: "你好", mode: "token" } });
      const message = await transaction.message.create({ data: { conversationId: "conversation-1", role: "assistant", content: "你好呀", mode: "token" } });
      return { messageId: message.id, provider: "mock", inputTokens: 20, outputTokens: 10, result: message };
    });

    expect(result).toEqual({ id: "message-2", content: "你好呀" });
    expect(prisma.state.account?.paidBalance).toBe(20);
    expect(prisma.state.records).toMatchObject([{
      userId: "user-1",
      conversationId: "conversation-1",
      messageId: "message-2",
      generationRequestId: prisma.state.requests[0]!.id,
      mode: "token",
      bucket: "paid",
      inputTokens: 20,
      outputTokens: 10,
      totalTokens: 30,
      source: "simulated"
    }]);
  });

  it("rejects an insufficient simulated token balance without persisting a reply or usage", async () => {
    const prisma = createUsagePrisma({ paidBalance: 29 });
    const service = new UsageService(prisma as never);

    await expect(service.settleSimulatedTokenWithMessages("user-1", {
      conversationId: "conversation-1",
      requestId: "request-1"
    }, async (transaction) => {
      await transaction.message.create({ data: { conversationId: "conversation-1", role: "user", content: "你好", mode: "token" } });
      const message = await transaction.message.create({ data: { conversationId: "conversation-1", role: "assistant", content: "你好呀", mode: "token" } });
      return { messageId: message.id, provider: "mock", inputTokens: 20, outputTokens: 10, result: message };
    })).rejects.toMatchObject({ response: { code: "TOKEN_QUOTA_REQUIRED" } });

    expect(prisma.state.messages).toEqual([]);
    expect(prisma.state.account?.paidBalance).toBe(29);
    expect(prisma.state.records).toEqual([]);
    expect(prisma.state.requests).toEqual([]);
  });
});
