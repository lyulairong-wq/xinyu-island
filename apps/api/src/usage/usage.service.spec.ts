import { describe, expect, it, vi } from "vitest";
import { UsageService } from "./usage.service";

function createUsagePrisma() {
  const account = { id: "account-1", userId: "user-1", freeLimit: 100, freeUsed: 20, freeResetAt: new Date(Date.now() + 86_400_000), paidBalance: 50 };
  return {
    tokenAccount: {
      upsert: vi.fn(async () => account),
      update: vi.fn(async ({ data }: { data: { freeUsed?: { increment?: number }; paidBalance?: { decrement?: number } } }) => {
        if (data.freeUsed?.increment) account.freeUsed += data.freeUsed.increment;
        if (data.paidBalance?.decrement) account.paidBalance -= data.paidBalance.decrement;
        return account;
      })
    },
    tokenUsageRecord: { create: vi.fn(async ({ data }: { data: object }) => data), findMany: vi.fn(async () => []) }
  };
}

describe("UsageService", () => {
  it("reports and consumes free resource quota", async () => {
    const prisma = createUsagePrisma();
    const service = new UsageService(prisma as never);
    expect((await service.getSummary("user-1")).free.remaining).toBe(80);
    await service.assertAvailable("user-1", "free", 20);
    await service.consume("user-1", { mode: "free", conversationId: "c1", messageId: "m1", inputTokens: 10, outputTokens: 10 });
    expect((await service.getSummary("user-1")).free.used).toBe(40);
  });

  it("rejects token usage above paid balance", async () => {
    const prisma = createUsagePrisma();
    const service = new UsageService(prisma as never);
    await expect(service.assertAvailable("user-1", "token", 51)).rejects.toMatchObject({ response: { code: "TOKEN_QUOTA_REQUIRED" } });
  });
});
