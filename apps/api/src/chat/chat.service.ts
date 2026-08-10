import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { loadConfig } from "@xinyu/config";
import { evaluateMessage } from "@xinyu/safety";
import { PrismaService } from "../prisma/prisma.service";
import { ContactsService } from "../contacts/contacts.service";
import { ModelGatewayService, type ModelGatewayResult } from "../model-gateway/model-gateway.service";
import { estimateTokens } from "../model-gateway/model-limits";
import { UsageService, type FreeReservation } from "../usage/usage.service";
import type { SendMessageDto } from "./dto/send-message.dto";

type MessageConversation = {
  id: string;
  contactId: string;
  kind: string;
  memoryEnabled: boolean;
  members: Array<{ contactId: string; sortOrder: number }>;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly usage: UsageService,
    private readonly gateway: ModelGatewayService
  ) {}

  async createConversation(userId: string, contactId: string, memoryEnabled?: boolean) {
    const contact = await this.contacts.resolve(userId, contactId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { defaultMemoryEnabled: true } });
    const conversation = await this.prisma.conversation.create({ data: { userId, contactId, kind: "single", memoryEnabled: memoryEnabled ?? user?.defaultMemoryEnabled ?? false } });
    return { id: conversation.id, contact, memoryEnabled: conversation.memoryEnabled };
  }

  async createGroup(userId: string, contactIds: string[], memoryEnabled?: boolean) {
    const uniqueIds = [...new Set(contactIds)];
    const contacts = await Promise.all(uniqueIds.map((contactId) => this.contacts.resolve(userId, contactId)));
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { defaultMemoryEnabled: true } });
    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        contactId: contacts[0]!.id,
        kind: "group",
        memoryEnabled: memoryEnabled ?? user?.defaultMemoryEnabled ?? false,
        members: { create: contacts.map((contact, index) => ({ contactId: contact.id, sortOrder: index })) }
      }
    });
    return { id: conversation.id, kind: "group", members: contacts, memoryEnabled: conversation.memoryEnabled };
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.getOwnedConversation(userId, conversationId);
    return { ...conversation, contact: await this.contacts.resolve(userId, conversation.contactId) };
  }

  async listConversations(userId: string, includeArchived = false) {
    const conversations = await this.prisma.conversation.findMany({ where: { userId, ...(includeArchived ? {} : { archivedAt: null }) }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, contactId: true, kind: true, title: true, memoryEnabled: true, archivedAt: true, updatedAt: true, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } } } });
    return Promise.all(conversations.map(async (conversation) => ({ ...conversation, contact: await this.contacts.resolve(userId, conversation.contactId), preview: conversation.messages[0]?.content ?? "尚未开始聊天" })));
  }

  async updateConversation(userId: string, conversationId: string, input: { memoryEnabled?: boolean; title?: string; archived?: boolean }) {
    const existing = await this.getOwnedConversation(userId, conversationId);
    if (input.memoryEnabled === undefined && input.title === undefined && input.archived === undefined) throw new BadRequestException("At least one conversation setting is required");
    return this.prisma.conversation.update({
      where: { id: existing.id },
      data: {
        ...(input.memoryEnabled === undefined ? {} : { memoryEnabled: input.memoryEnabled }),
        ...(input.title === undefined ? {} : { title: input.title.trim() }),
        ...(input.archived === undefined ? {} : { archivedAt: input.archived ? new Date() : null })
      },
      select: { id: true, title: true, memoryEnabled: true, archivedAt: true }
    });
  }

  async deleteConversation(userId: string, conversationId: string) {
    const existing = await this.getOwnedConversation(userId, conversationId);
    await this.prisma.conversation.delete({ where: { id: existing.id } });
    return { success: true };
  }

  async sendMessage(userId: string, conversationId: string, input: SendMessageDto) {
    const conversation = await this.getOwnedConversation(userId, conversationId);
    const contact = await this.contacts.resolve(userId, conversation.contactId);
    const quotedMessage = input.quoteMessageId
      ? await this.prisma.message.findFirst({ where: { id: input.quoteMessageId, conversationId }, select: { id: true, content: true } })
      : null;
    if (input.quoteMessageId && !quotedMessage) throw new NotFoundException("Quoted message was not found in this conversation");

    const content = input.content.trim();
    const modelConfig = loadConfig(process.env).freeModel;
    if (!content) throw new BadRequestException({ code: "GENERATION_INPUT_INVALID" });
    if (content.length > modelConfig.maxInputCharacters) {
      throw new BadRequestException({ code: "GENERATION_INPUT_TOO_LONG", maxInputCharacters: modelConfig.maxInputCharacters });
    }

    const generationInput = quotedMessage ? `Quoted message: ${quotedMessage.content}\n\nUser message: ${content}` : content;
    const inputSafety = evaluateMessage(generationInput);
    if (inputSafety.action === "block") {
      const userMessage = await this.persistUserMessage(conversationId, input, content, quotedMessage?.id);
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId,
          role: "assistant",
          content: "这类内容我不能提供具体指导。心屿仅用于娱乐和陪伴；如果你正面临现实中的紧急风险，请联系当地紧急服务或可信任的人。",
          mode: input.mode
        }
      });
      return {
        userMessage,
        assistantMessage,
        mode: input.mode,
        chargedTokens: 0,
        blocked: true,
        category: inputSafety.category,
        notice: "该问题涉及高风险内容，已停止提供具体建议。"
      };
    }

    if (conversation.kind === "group") {
      return this.sendGroupMessage(userId, conversation as MessageConversation, input, content, generationInput, quotedMessage?.id, modelConfig.maxOutputTokens);
    }

    return this.sendSingleMessage(userId, conversation as MessageConversation, contact, input, content, generationInput, quotedMessage?.id, modelConfig.maxOutputTokens);
  }

  private async sendSingleMessage(
    userId: string,
    conversation: MessageConversation,
    contact: { name: string; tone: string },
    input: SendMessageDto,
    content: string,
    generationInput: string,
    quotedMessageId: string | undefined,
    maxOutputTokens: number
  ) {
    const estimatedInputTokens = estimateTokens(generationInput);
    let reservation: FreeReservation | undefined;

    if (input.mode === "free") {
      reservation = await this.usage.reserveFree(userId, input.requestId, {
        conversationId: conversation.id,
        inputTokens: estimatedInputTokens,
        outputTokens: maxOutputTokens
      });
    } else {
      await this.usage.assertAvailable(userId, input.mode, estimatedInputTokens + maxOutputTokens);
    }

    try {
      const userMessage = await this.persistUserMessage(conversation.id, input, content, quotedMessageId);
      const memoryContext = await this.memoryContext(userId, conversation);
      const generated = await this.gateway.generate({
        conversationId: conversation.id,
        content: generationInput,
        mode: input.mode,
        maxOutputTokens,
        systemPrompt: this.systemPrompt(contact.name, contact.tone, memoryContext)
      });
      this.assertSafeOutput(generated.text);

      const assistantMessage = await this.prisma.message.create({
        data: { conversationId: conversation.id, role: "assistant", content: generated.text, mode: input.mode }
      });
      await this.finalizeUsage(userId, input.mode, reservation, generated, conversation.id, assistantMessage.id);
      reservation = undefined;

      const notice = input.mode === "free"
        ? generated.provider === "mock"
          ? "当前使用免费 Mock 回复，仅供娱乐参考。"
          : "当前使用免费开源模型回复，仅供娱乐参考。"
        : "Token 模式接口已预留，当前未产生 Token 消耗，仅供娱乐参考。";
      return {
        userMessage,
        assistantMessage,
        mode: input.mode,
        provider: generated.provider,
        degraded: generated.degraded,
        chargedTokens: input.mode === "token" ? generated.inputTokens + generated.outputTokens : 0,
        notice,
        estimatedResourceTokens: generated.inputTokens + generated.outputTokens
      };
    } catch (error) {
      if (reservation) await this.usage.releaseFree(reservation);
      throw error;
    }
  }

  private async sendGroupMessage(
    userId: string,
    conversation: MessageConversation,
    input: SendMessageDto,
    content: string,
    generationInput: string,
    quotedMessageId: string | undefined,
    maxOutputTokens: number
  ) {
    const members = [...conversation.members].sort((a, b) => a.sortOrder - b.sortOrder);
    const estimatedInputTokens = estimateTokens(generationInput) * members.length;
    let reservation: FreeReservation | undefined;

    if (input.mode === "free") {
      reservation = await this.usage.reserveFree(userId, input.requestId, {
        conversationId: conversation.id,
        inputTokens: estimatedInputTokens,
        outputTokens: maxOutputTokens * members.length
      });
    } else {
      await this.usage.assertAvailable(userId, input.mode, estimatedInputTokens + maxOutputTokens * members.length);
    }

    try {
      const userMessage = await this.persistUserMessage(conversation.id, input, content, quotedMessageId);
      const memoryContext = await this.memoryContext(userId, conversation);
      const generatedReplies: ModelGatewayResult[] = [];

      for (const member of members) {
        const contact = await this.contacts.resolve(userId, member.contactId);
        const generated = await this.gateway.generate({
          conversationId: conversation.id,
          content: generationInput,
          mode: input.mode,
          maxOutputTokens,
          systemPrompt: this.systemPrompt(contact.name, contact.tone, memoryContext)
        });
        this.assertSafeOutput(generated.text);
        generatedReplies.push(generated);
      }

      const assistantMessages = [];
      for (const generated of generatedReplies) {
        assistantMessages.push(await this.prisma.message.create({
          data: { conversationId: conversation.id, role: "assistant", content: generated.text, mode: input.mode }
        }));
      }

      const inputTokens = generatedReplies.reduce((sum, generated) => sum + generated.inputTokens, 0);
      const outputTokens = generatedReplies.reduce((sum, generated) => sum + generated.outputTokens, 0);
      const providers = [...new Set(generatedReplies.map((generated) => generated.provider))];
      const aggregate: ModelGatewayResult = {
        text: generatedReplies.map((generated) => generated.text).join("\n"),
        provider: providers[0] ?? "mock",
        degraded: generatedReplies.some((generated) => generated.degraded),
        inputTokens,
        outputTokens
      };
      await this.finalizeUsage(userId, input.mode, reservation, aggregate, conversation.id, assistantMessages[0]!.id, providers.join(","));
      reservation = undefined;

      return {
        userMessage,
        assistantMessages,
        mode: input.mode,
        providers,
        degraded: aggregate.degraded,
        chargedTokens: input.mode === "token" ? inputTokens + outputTokens : 0,
        notice: "讨论组已按成员顺序回复，仅供娱乐参考。"
      };
    } catch (error) {
      if (reservation) await this.usage.releaseFree(reservation);
      throw error;
    }
  }

  private async finalizeUsage(
    userId: string,
    mode: "free" | "token",
    reservation: FreeReservation | undefined,
    generated: ModelGatewayResult,
    conversationId: string,
    messageId: string,
    provider: string = generated.provider
  ) {
    if (mode === "free") {
      await this.usage.finalizeFree(reservation!, {
        provider,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens
      });
      return;
    }

    await this.usage.consume(userId, {
      mode,
      conversationId,
      messageId,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens
    });
  }

  private async persistUserMessage(conversationId: string, input: SendMessageDto, content: string, quotedMessageId?: string) {
    return this.prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content,
        mode: input.mode,
        ...(quotedMessageId ? { quotedMessageId } : {})
      }
    });
  }

  private async memoryContext(userId: string, conversation: Pick<MessageConversation, "memoryEnabled" | "contactId">) {
    const memories = conversation.memoryEnabled
      ? await this.prisma.contactMemory.findMany({
          where: { userId, contactId: conversation.contactId, sensitivity: "normal" },
          orderBy: { updatedAt: "desc" },
          take: 20
        })
      : [];
    return memories.length
      ? `仅参考以下用户明确保存的普通记忆：${memories.map((memory) => memory.fact).join("；")}`
      : "当前不使用长期记忆。";
  }

  private systemPrompt(name: string, tone: string, memoryContext: string) {
    return `你是${name}，互动风格是${tone}。你只能提供娱乐和陪伴，不提供医疗、法律、财务或其他需要承担责任的具体建议。${memoryContext}`;
  }

  private assertSafeOutput(text: string) {
    if (evaluateMessage(text).action === "block") {
      throw new BadRequestException({ code: "GENERATION_OUTPUT_REJECTED" });
    }
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string) {
    await this.getOwnedConversation(userId, conversationId);
    const message = await this.prisma.message.findFirst({ where: { id: messageId, conversationId }, select: { id: true } });
    if (!message) throw new NotFoundException("Message was not found in this conversation");
    await this.prisma.message.delete({ where: { id: message.id } });
    return { success: true };
  }

  private async getOwnedConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId }, include: { messages: { orderBy: { createdAt: "asc" } }, members: { orderBy: { sortOrder: "asc" } } } });
    if (!conversation) throw new NotFoundException("找不到该对话");
    return conversation;
  }
}
