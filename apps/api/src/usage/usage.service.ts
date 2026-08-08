import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const FREE_LIMIT = Number(process.env.FREE_TOKEN_LIMIT ?? 10_000);
const RESET_DAYS = 30;

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const account = await this.ensureAccount(userId);
    const current = await this.resetIfNeeded(account);
    return { free: { limit: current.freeLimit, used: current.freeUsed, remaining: Math.max(current.freeLimit - current.freeUsed, 0), resetAt: current.freeResetAt }, token: { paidBalance: current.paidBalance } };
  }

  async assertAvailable(userId: string, mode: "free" | "token", estimatedTokens: number) {
    const account = await this.resetIfNeeded(await this.ensureAccount(userId));
    if (mode === "free" && account.freeUsed + estimatedTokens > account.freeLimit) {
      throw new BadRequestException({ code: "FREE_QUOTA_EXCEEDED", message: "免费模式额度已用完，请等待重置或切换其他使用方式" });
    }
    if (mode === "token" && account.paidBalance < estimatedTokens) {
      throw new BadRequestException({ code: "TOKEN_QUOTA_REQUIRED", message: "Token 模式需要可用 Token 余额，当前暂未配置付费额度" });
    }
  }

  async consume(userId: string, input: { mode: "free" | "token"; conversationId: string; messageId: string; inputTokens: number; outputTokens: number }) {
    const totalTokens = input.inputTokens + input.outputTokens;
    const account = await this.resetIfNeeded(await this.ensureAccount(userId));
    if (input.mode === "free") {
      await this.prisma.tokenAccount.update({ where: { id: account.id }, data: { freeUsed: { increment: totalTokens } } });
    } else {
      await this.prisma.tokenAccount.update({ where: { id: account.id }, data: { paidBalance: { decrement: totalTokens } } });
    }
    return this.prisma.tokenUsageRecord.create({ data: { userId, conversationId: input.conversationId, messageId: input.messageId, mode: input.mode, bucket: input.mode === "free" ? "free" : "paid", inputTokens: input.inputTokens, outputTokens: input.outputTokens, totalTokens, source: "estimated" } });
  }

  async listRecords(userId: string) {
    return this.prisma.tokenUsageRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  private async ensureAccount(userId: string) {
    return this.prisma.tokenAccount.upsert({ where: { userId }, create: { userId, freeLimit: FREE_LIMIT, freeResetAt: this.nextReset() }, update: {} });
  }

  private async resetIfNeeded(account: { id: string; freeResetAt: Date; freeUsed: number; freeLimit: number; paidBalance: number }) {
    if (account.freeResetAt > new Date()) return account;
    return this.prisma.tokenAccount.update({ where: { id: account.id }, data: { freeUsed: 0, freeResetAt: this.nextReset() } });
  }

  private nextReset() { return new Date(Date.now() + RESET_DAYS * 24 * 60 * 60 * 1000); }
}
