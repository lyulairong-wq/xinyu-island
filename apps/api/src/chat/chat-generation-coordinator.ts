import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { MockAiProvider, type GenerationRequest } from "@xinyu/ai";
import type { Prisma } from "@prisma/client";
import { ModelGatewayService, type ModelGatewayResult } from "../model-gateway/model-gateway.service";
import { estimateTokens } from "../model-gateway/model-limits";
import { PrismaService } from "../prisma/prisma.service";
import { UsageService, type FreeReservation } from "../usage/usage.service";
import { GenerationPolicy } from "./generation-policy";

export type ChatGenerationInput = {
  userId: string;
  conversationId: string;
  requestId: string;
  kind: "single" | "group";
  mode: "free" | "token";
  content: string;
  quote?: { id: string; content: string };
  contacts: Array<{ name: string; systemPrompt: string }>;
  maxInputCharacters: number;
  maxOutputTokens: number;
};

type GeneratedReply = ModelGatewayResult;

export class ChatGenerationCoordinator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly gateway: ModelGatewayService,
    private readonly policy: GenerationPolicy = new GenerationPolicy()
  ) {}

  async generate(input: ChatGenerationInput) {
    const content = this.normalizedUserContent(input.content, input.maxInputCharacters);
    const quote = input.quote
      ? { ...input.quote, content: this.policy.assertQuoteContent(input.quote.content.trim()).trim() }
      : undefined;
    if (input.contacts.length === 0) throw new BadRequestException({ code: "GENERATION_INPUT_INVALID" });

    const generationContent = quote
      ? `引用消息：${quote.content}\n\n用户消息：${content}`
      : content;

    if (input.mode === "token") {
      return this.settleToken(input, generationContent, content, quote?.id);
    }

    const estimatedInputTokens = estimateTokens(generationContent) * input.contacts.length;
    let reservation: FreeReservation | undefined;

    reservation = await this.usage.reserveFree(input.userId, input.requestId, {
      conversationId: input.conversationId,
      inputTokens: estimatedInputTokens,
      outputTokens: input.maxOutputTokens * input.contacts.length
    });

    try {
      const userMessage = await this.persistUserMessage(this.prisma, input, content, quote?.id);
      const replies = await this.collectReplies(input, generationContent);
      const inputTokens = replies.reduce((sum, reply) => sum + reply.inputTokens, 0);
      const outputTokens = replies.reduce((sum, reply) => sum + reply.outputTokens, 0);
      const assistantMessages = await this.settleFree(reservation, input, replies, inputTokens, outputTokens);

      reservation = undefined;
      return this.response(input, userMessage, assistantMessages, replies, inputTokens, outputTokens);
    } catch (error) {
      if (reservation) await this.usage.releaseFree(reservation);
      throw error;
    }
  }

  private normalizedUserContent(content: string, maxInputCharacters: number) {
    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException({ code: "GENERATION_INPUT_INVALID" });

    const normalized = this.policy.assertUserContent(trimmed).trim();
    if (!normalized) throw new BadRequestException({ code: "GENERATION_INPUT_INVALID" });
    if (normalized.length > maxInputCharacters) {
      throw new BadRequestException({ code: "GENERATION_INPUT_TOO_LONG", maxInputCharacters });
    }
    return normalized;
  }

  private async collectReplies(input: ChatGenerationInput, content: string) {
    const replies: GeneratedReply[] = [];

    for (const contact of input.contacts) {
      const generated = input.mode === "free"
        ? await this.gateway.generate({
            conversationId: input.conversationId,
            content,
            mode: "free",
            maxOutputTokens: input.maxOutputTokens,
            systemPrompt: contact.systemPrompt
          })
        : await this.generateMockReply(contact.name, {
            conversationId: input.conversationId,
            content,
            mode: "token",
            maxOutputTokens: input.maxOutputTokens,
            systemPrompt: contact.systemPrompt
          });
      replies.push({ ...generated, text: this.policy.assertAssistantContent(generated.text).trim() });
    }

    return replies;
  }

  private async generateMockReply(contactName: string, request: GenerationRequest): Promise<GeneratedReply> {
    const provider = new MockAiProvider(contactName);
    let deltaText = "";
    let completedText = "";
    let failed = false;

    for await (const event of provider.generate(request)) {
      if (event.type === "delta" && event.text) deltaText += event.text;
      if (event.type === "completed") completedText = event.text ?? deltaText;
      if (event.type === "failed") failed = true;
    }

    const text = (completedText || deltaText).trim();
    if (failed || !text) throw new ServiceUnavailableException({ code: "MODEL_UNAVAILABLE" });

    return {
      text,
      provider: "mock",
      degraded: true,
      inputTokens: estimateTokens(request.content),
      outputTokens: estimateTokens(text)
    };
  }

  private async settleFree(
    reservation: FreeReservation,
    input: ChatGenerationInput,
    replies: GeneratedReply[],
    inputTokens: number,
    outputTokens: number
  ) {
    const providers = [...new Set(replies.map((reply) => reply.provider))];
    return this.usage.finalizeFreeWithMessage(reservation, {
      provider: providers.join(","),
      inputTokens,
      outputTokens
    }, (transaction) => this.persistAssistantMessages(transaction, input, replies));
  }

  private settleToken(
    input: ChatGenerationInput,
    generationContent: string,
    content: string,
    quotedMessageId?: string
  ) {
    return this.usage.settleSimulatedTokenWithMessages(input.userId, {
      conversationId: input.conversationId,
      requestId: input.requestId
    }, async (transaction) => {
      const replies = await this.collectReplies(input, generationContent);
      const inputTokens = replies.reduce((sum, reply) => sum + reply.inputTokens, 0);
      const outputTokens = replies.reduce((sum, reply) => sum + reply.outputTokens, 0);
      const userMessage = await this.persistUserMessage(transaction, input, content, quotedMessageId);
      const assistantMessages = (await this.persistAssistantMessages(transaction, input, replies)).result;

      return {
        messageId: assistantMessages[0]!.id,
        provider: "mock",
        inputTokens,
        outputTokens,
        result: this.response(input, userMessage, assistantMessages, replies, inputTokens, outputTokens)
      };
    });
  }

  private async persistAssistantMessages(transaction: Prisma.TransactionClient, input: ChatGenerationInput, replies: GeneratedReply[]) {
    const messages = [];
    for (const reply of replies) {
      messages.push(await transaction.message.create({
        data: { conversationId: input.conversationId, role: "assistant", content: reply.text, mode: input.mode }
      }));
    }
    return { messageId: messages[0]!.id, result: messages };
  }

  private persistUserMessage(
    client: PrismaService | Prisma.TransactionClient,
    input: ChatGenerationInput,
    content: string,
    quotedMessageId?: string
  ) {
    return client.message.create({
      data: {
        conversationId: input.conversationId,
        role: "user",
        content,
        mode: input.mode,
        ...(quotedMessageId ? { quotedMessageId } : {})
      }
    });
  }

  private response(
    input: ChatGenerationInput,
    userMessage: Awaited<ReturnType<ChatGenerationCoordinator["persistUserMessage"]>>,
    assistantMessages: Awaited<ReturnType<ChatGenerationCoordinator["settleFree"]>>,
    replies: GeneratedReply[],
    inputTokens: number,
    outputTokens: number
  ) {
    const chargedTokens = input.mode === "token" ? inputTokens + outputTokens : 0;

    if (input.kind === "group") {
      return {
        userMessage,
        assistantMessages,
        mode: input.mode,
        ...(input.mode === "free" ? {
          providers: [...new Set(replies.map((reply) => reply.provider))],
          degraded: replies.some((reply) => reply.degraded)
        } : {}),
        chargedTokens,
        notice: "讨论组已按成员顺序回复，仅供娱乐参考。"
      };
    }

    const reply = replies[0]!;
    return {
      userMessage,
      assistantMessage: assistantMessages[0]!,
      mode: input.mode,
      ...(input.mode === "free" ? { provider: reply.provider, degraded: reply.degraded } : {}),
      chargedTokens,
      notice: input.mode === "free"
        ? reply.provider === "mock"
          ? "当前使用免费 Mock 回复，仅供娱乐参考。"
          : "当前使用免费开源模型回复，仅供娱乐参考。"
        : "Token 模式接口已预留，当前未产生 Token 消耗，仅供娱乐参考。",
      estimatedResourceTokens: inputTokens + outputTokens
    };
  }
}
