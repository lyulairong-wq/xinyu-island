import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { loadBetaConfig } from "@xinyu/config";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_FREE_LIMIT = 6_000;
const DEFAULT_COOLDOWN_MS = 3_000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1_000;
const SERIALIZABLE_RETRIES = 3;

export type FreeGenerationEstimate = {
  conversationId: string;
  inputTokens: number;
  outputTokens: number;
};

export type FreeGenerationActual = {
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type FreeReservation = {
  id: string;
  userId: string;
  conversationId: string;
  requestId: string;
  mode: string;
  status: string;
  provider: string | null;
  reservedTokens: number;
  completedAt: Date | null;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
};

export type FreeFinalization<T> = {
  messageId: string;
  result: T;
};

export type SimulatedTokenFinalization<T> = FreeFinalization<T> & {
  provider: string;
  inputTokens: number;
  outputTokens: number;
};

type Account = {
  id: string;
  freeResetAt: Date;
  freeUsed: number;
  freeLimit: number;
  paidBalance: number;
};

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

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
      throw this.freeError("FREE_QUOTA_EXCEEDED");
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

  async settleSimulatedTokenWithMessages<T>(
    userId: string,
    input: { conversationId: string; requestId: string },
    persist: (transaction: Prisma.TransactionClient) => Promise<SimulatedTokenFinalization<T>>
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const duplicate = await transaction.generationRequest.findUnique({
          where: { userId_requestId: { userId, requestId: input.requestId } }
        });
        if (duplicate) throw this.duplicateGenerationError(duplicate, input.conversationId);

        const request = await transaction.generationRequest.create({
          data: {
            userId,
            conversationId: input.conversationId,
            requestId: input.requestId,
            mode: "token",
            status: "running",
            reservedTokens: 0
          }
        });
        const finalized = await persist(transaction);
        const totalTokens = this.sumTokens(finalized.inputTokens, finalized.outputTokens);
        const account = await this.assertSimulatedTokenBalanceInTransaction(userId, totalTokens, transaction);

        await transaction.tokenAccount.update({ where: { id: account.id }, data: { paidBalance: { decrement: totalTokens } } });
        await transaction.tokenUsageRecord.create({
          data: {
            userId,
            conversationId: input.conversationId,
            messageId: finalized.messageId,
            generationRequestId: request.id,
            mode: "token",
            bucket: "paid",
            inputTokens: finalized.inputTokens,
            outputTokens: finalized.outputTokens,
            totalTokens,
            source: "simulated"
          }
        });
        await transaction.generationRequest.update({
          where: { id: request.id },
          data: { status: "completed", provider: finalized.provider, completedAt: new Date() }
        });
        return finalized.result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (this.isPrismaError(error, "P2002") || this.isPrismaError(error, "P2034")) {
        throw new ConflictException({ code: "GENERATION_IN_PROGRESS" });
      }
      throw error;
    }
  }

  async reserveFree(userId: string, requestId: string, estimate: FreeGenerationEstimate): Promise<FreeReservation> {
    const reservedTokens = this.sumTokens(estimate.inputTokens, estimate.outputTokens);
    const now = new Date();

    try {
      const reservation = await this.runSerializable(async (transaction) => {
        const duplicate = await transaction.generationRequest.findUnique({ where: { userId_requestId: { userId, requestId } } });
        if (duplicate) throw this.freeError("FREE_GENERATION_IN_PROGRESS");

        const active = await transaction.generationRequest.findFirst({ where: { userId, status: "reserved" } });
        if (active) throw this.freeError("FREE_GENERATION_IN_PROGRESS");

        const cooldownStartedAfter = new Date(now.getTime() - this.cooldownMs());
        const coolingDown = await transaction.generationRequest.findFirst({
          where: { userId, status: "completed", completedAt: { gt: cooldownStartedAfter } }
        });
        if (coolingDown) throw this.freeError("FREE_COOLDOWN_ACTIVE");

        const account = await this.resetIfNeeded(await this.ensureAccount(userId, transaction), transaction, now);
        if (account.freeUsed + reservedTokens > account.freeLimit) throw this.freeError("FREE_QUOTA_EXCEEDED");
        const projectUsage = await transaction.generationRequest.aggregate({
          where: { mode: "free", status: { in: ["reserved", "completed"] } },
          _sum: { reservedTokens: true }
        });
        if ((projectUsage._sum.reservedTokens ?? 0) + reservedTokens > loadBetaConfig(process.env).projectTokenLimit) {
          throw this.freeError("BETA_PROJECT_QUOTA_EXCEEDED");
        }

        const created = await transaction.generationRequest.create({
          data: { userId, conversationId: estimate.conversationId, requestId, mode: "free", status: "reserved", reservedTokens }
        });
        await transaction.tokenAccount.update({ where: { id: account.id }, data: { freeUsed: { increment: reservedTokens } } });
        return created;
      });

      return { ...reservation, estimatedInputTokens: estimate.inputTokens, estimatedOutputTokens: estimate.outputTokens };
    } catch (error) {
      if (this.isPrismaError(error, "P2002")) throw this.freeError("FREE_GENERATION_IN_PROGRESS");
      throw error;
    }
  }

  async finalizeFree(reservation: FreeReservation, actual: FreeGenerationActual) {
    try {
      const finalized = await this.runSerializable((transaction) => this.finalizeFreeInTransaction(transaction, reservation, actual));
      return finalized.record;
    } catch (error) {
      if (this.isPrismaError(error, "P2002")) {
        const existingRecord = await this.prisma.tokenUsageRecord.findUnique({ where: { generationRequestId: reservation.id } });
        if (existingRecord) return existingRecord;
      }
      throw error;
    }
  }

  async finalizeFreeWithMessage<T>(reservation: FreeReservation, actual: FreeGenerationActual, persist: (transaction: Prisma.TransactionClient) => Promise<FreeFinalization<T>>): Promise<T> {
    return this.runSerializable(async (transaction) => {
      const finalized = await this.finalizeFreeInTransaction(transaction, reservation, actual, persist);
      return finalized.result;
    });
  }

  async releaseFree(reservation: FreeReservation) {
    return this.runSerializable(async (transaction) => {
      const current = await transaction.generationRequest.findUnique({ where: { id: reservation.id } });
      if (!current || current.status !== "reserved") return current;

      const account = await this.ensureAccount(current.userId, transaction);
      await transaction.tokenAccount.update({
        where: { id: account.id },
        data: { freeUsed: Math.max(account.freeUsed - current.reservedTokens, 0) }
      });
      return transaction.generationRequest.update({ where: { id: current.id }, data: { status: "failed" } });
    });
  }

  async listRecords(userId: string) {
    return this.prisma.tokenUsageRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  private async finalizeFreeInTransaction<T = undefined>(
    transaction: Prisma.TransactionClient,
    reservation: FreeReservation,
    actual: FreeGenerationActual,
    persist?: (transaction: Prisma.TransactionClient) => Promise<FreeFinalization<T>>
  ): Promise<{ record: Awaited<ReturnType<Prisma.TransactionClient["tokenUsageRecord"]["create"]>>; result: T }> {
    const current = await transaction.generationRequest.findUnique({ where: { id: reservation.id } });
    if (!current) throw this.freeError("FREE_GENERATION_IN_PROGRESS");

    const existingRecord = await transaction.tokenUsageRecord.findUnique({ where: { generationRequestId: current.id } });
    if (existingRecord) {
      if (persist) throw this.freeError("FREE_GENERATION_IN_PROGRESS");
      return { record: existingRecord, result: undefined as T };
    }
    if (current.status !== "reserved") throw this.freeError("FREE_GENERATION_IN_PROGRESS");

    const finalized = persist ? await persist(transaction) : undefined;
    const providerReportedUsage = this.hasProviderUsage(actual);
    const inputTokens = providerReportedUsage ? actual.inputTokens! : reservation.estimatedInputTokens ?? current.reservedTokens;
    const outputTokens = providerReportedUsage ? actual.outputTokens! : reservation.estimatedOutputTokens ?? 0;
    const totalTokens = this.sumTokens(inputTokens, outputTokens);
    const account = await this.ensureAccount(current.userId, transaction);

    await transaction.tokenAccount.update({
      where: { id: account.id },
      data: { freeUsed: Math.max(account.freeUsed - current.reservedTokens + totalTokens, 0) }
    });
    const record = await transaction.tokenUsageRecord.create({
      data: {
        userId: current.userId,
        conversationId: current.conversationId,
        messageId: finalized?.messageId ?? null,
        generationRequestId: current.id,
        mode: current.mode,
        bucket: "free",
        inputTokens,
        outputTokens,
        totalTokens,
        source: providerReportedUsage ? "provider" : "estimated"
      }
    });
    await transaction.generationRequest.update({
      where: { id: current.id },
      data: { status: "completed", provider: actual.provider ?? current.provider, completedAt: new Date() }
    });
    return { record, result: finalized?.result as T };
  }

  private async runSerializable<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < SERIALIZABLE_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!this.isPrismaError(error, "P2034")) throw error;
        if (attempt === SERIALIZABLE_RETRIES - 1) throw this.freeError("FREE_GENERATION_IN_PROGRESS");
      }
    }
    throw this.freeError("FREE_GENERATION_IN_PROGRESS");
  }

  private async ensureAccount(userId: string, client: PrismaClientLike = this.prisma) {
    const freeLimit = this.freeLimit();
    return client.tokenAccount.upsert({
      where: { userId },
      create: { userId, freeLimit, freeResetAt: this.nextReset() },
      update: { freeLimit }
    });
  }

  private async resetIfNeeded(account: Account, client: PrismaClientLike = this.prisma, now = new Date()) {
    if (account.freeResetAt > now) return account;
    return client.tokenAccount.update({ where: { id: account.id }, data: { freeUsed: 0, freeResetAt: this.nextReset(now) } });
  }

  private nextReset(now = new Date()) {
    const beijing = new Date(now.getTime() + BEIJING_OFFSET_MS);
    return new Date(Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate() + 1) - BEIJING_OFFSET_MS);
  }

  private freeLimit() {
    return this.positiveEnvironmentInteger("FREE_TOKEN_LIMIT", DEFAULT_FREE_LIMIT);
  }

  private cooldownMs() {
    return this.positiveEnvironmentInteger("FREE_USER_COOLDOWN_MS", DEFAULT_COOLDOWN_MS);
  }

  private positiveEnvironmentInteger(name: string, fallback: number) {
    const value = Number(process.env[name] ?? fallback);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }

  private hasProviderUsage(actual: FreeGenerationActual): actual is Required<Pick<FreeGenerationActual, "inputTokens" | "outputTokens">> & FreeGenerationActual {
    return this.isTokenCount(actual.inputTokens) && this.isTokenCount(actual.outputTokens);
  }

  private sumTokens(inputTokens: number, outputTokens: number) {
    if (!this.isTokenCount(inputTokens) || !this.isTokenCount(outputTokens) || !Number.isSafeInteger(inputTokens + outputTokens)) {
      throw new BadRequestException({ code: "GENERATION_USAGE_INVALID" });
    }
    return inputTokens + outputTokens;
  }

  private async assertSimulatedTokenBalanceInTransaction(userId: string, totalTokens: number, transaction: Prisma.TransactionClient): Promise<Account> {
    const account = await this.resetIfNeeded(await this.ensureAccount(userId, transaction), transaction);
    if (account.paidBalance < totalTokens) {
      throw new BadRequestException({ code: "TOKEN_QUOTA_REQUIRED" });
    }
    return account;
  }

  private isTokenCount(value: number | undefined): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  }

  private isPrismaError(error: unknown, code: string) {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
  }

  private duplicateGenerationError(
    request: { conversationId: string; mode: string; status: string },
    conversationId: string
  ) {
    if (request.conversationId !== conversationId || request.mode !== "token") {
      return new ConflictException({ code: "GENERATION_IDEMPOTENCY_CONFLICT" });
    }
    return new ConflictException({
      code: request.status === "completed" ? "GENERATION_ALREADY_COMPLETED" : "GENERATION_IN_PROGRESS"
    });
  }

  private freeError(code: "FREE_QUOTA_EXCEEDED" | "FREE_COOLDOWN_ACTIVE" | "FREE_GENERATION_IN_PROGRESS" | "BETA_PROJECT_QUOTA_EXCEEDED") {
    return new BadRequestException({ code });
  }
}
