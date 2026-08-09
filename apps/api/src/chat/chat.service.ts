import { Injectable, NotFoundException } from "@nestjs/common";
import { MockAiProvider, OpenAiCompatibleProvider, type AiProvider } from "@xinyu/ai";
import { evaluateMessage } from "@xinyu/safety";
import { PrismaService } from "../prisma/prisma.service";
import { ContactsService } from "../contacts/contacts.service";
import { UsageService } from "../usage/usage.service";
import type { SendMessageDto } from "./dto/send-message.dto";

@Injectable()
export class ChatService {
  private readonly mockProvider = new MockAiProvider();
  private readonly freeProvider: AiProvider;

  constructor(private readonly prisma: PrismaService, private readonly contacts: ContactsService, private readonly usage: UsageService) {
    const endpoint = process.env.FREE_MODEL_BASE_URL;
    const model = process.env.FREE_MODEL_NAME;
    this.freeProvider = endpoint && model ? new OpenAiCompatibleProvider(endpoint, model, Number(process.env.FREE_MODEL_TIMEOUT_MS ?? 30_000)) : this.mockProvider;
  }

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

  async updateConversationSettings(userId: string, conversationId: string, memoryEnabled: boolean) {
    const existing = await this.getOwnedConversation(userId, conversationId);
    return this.prisma.conversation.update({ where: { id: existing.id }, data: { memoryEnabled }, select: { id: true, memoryEnabled: true } });
  }

  async sendMessage(userId: string, conversationId: string, input: SendMessageDto) {
    const conversation = await this.getOwnedConversation(userId, conversationId);
    const contact = await this.contacts.resolve(userId, conversation.contactId);
    const userMessage = await this.prisma.message.create({ data: { conversationId, role: "user", content: input.content.trim(), mode: input.mode } });
    const safety = evaluateMessage(input.content);
    if (safety.action === "block") {
      const assistantMessage = await this.prisma.message.create({ data: { conversationId, role: "assistant", content: "这类内容我不能提供具体指导。心屿仅用于娱乐和陪伴；如果你正面临现实中的紧急风险，请联系当地紧急服务或可信任的人。", mode: input.mode } });
      return { userMessage, assistantMessage, mode: input.mode, chargedTokens: 0, blocked: true, category: safety.category, notice: "该问题涉及高风险内容，已停止提供具体建议。" };
    }
    if (conversation.kind === "group") return this.sendGroupMessage(userId, conversation, input, userMessage);
    const estimatedInputTokens = Math.ceil(input.content.trim().length / 2);
    await this.usage.assertAvailable(userId, input.mode, estimatedInputTokens + 200);
    const memories = conversation.memoryEnabled ? await this.prisma.contactMemory.findMany({ where: { userId, contactId: conversation.contactId, sensitivity: "normal" }, orderBy: { updatedAt: "desc" }, take: 20 }) : [];
    const memoryContext = memories.length ? `仅参考以下用户明确保存的普通记忆：${memories.map((memory) => memory.fact).join("；")}` : "当前不使用长期记忆。";
    const provider = input.mode === "free" ? (this.freeProvider === this.mockProvider ? new MockAiProvider(contact.name) : this.freeProvider) : new MockAiProvider(contact.name);
    let text = "";
    let failed = false;
    for await (const event of provider.generate({ conversationId, content: input.content, mode: input.mode, systemPrompt: `你是${contact.name}，互动风格是${contact.tone}。你只能提供娱乐和陪伴，不提供医疗、法律、财务或其他需要承担责任的具体建议。${memoryContext}` })) {
      if (event.type === "delta" && event.text) text += event.text;
      if (event.type === "failed") failed = true;
    }
    if (!text || failed) text = await this.collectMockReply(conversationId, input.content, contact.name);
    const assistantMessage = await this.prisma.message.create({ data: { conversationId, role: "assistant", content: text, mode: input.mode } });
    const outputTokens = Math.ceil(text.length / 2);
    await this.usage.consume(userId, { mode: input.mode, conversationId, messageId: assistantMessage.id, inputTokens: estimatedInputTokens, outputTokens });
    const notice = input.mode === "free" ? (this.freeProvider === this.mockProvider ? "当前使用免费 Mock 回复，仅供娱乐参考。" : "当前使用免费开源模型回复，仅供娱乐参考。") : "Token 模式接口已预留，当前未产生 Token 消耗，仅供娱乐参考。";
    return { userMessage, assistantMessage, mode: input.mode, chargedTokens: input.mode === "token" ? estimatedInputTokens + outputTokens : 0, notice, estimatedResourceTokens: estimatedInputTokens + outputTokens };
  }

  private async sendGroupMessage(userId: string, conversation: { id: string; contactId: string; memoryEnabled: boolean; members: Array<{ contactId: string; sortOrder: number }> }, input: SendMessageDto, userMessage: { id: string }) {
    const inputTokens = Math.ceil(input.content.trim().length / 2);
    await this.usage.assertAvailable(userId, input.mode, inputTokens + 200 * conversation.members.length);
    const memories = conversation.memoryEnabled ? await this.prisma.contactMemory.findMany({ where: { userId, contactId: conversation.contactId, sensitivity: "normal" }, orderBy: { updatedAt: "desc" }, take: 20 }) : [];
    const memoryContext = memories.length ? `仅参考以下用户明确保存的普通记忆：${memories.map((memory) => memory.fact).join("；")}` : "当前不使用长期记忆。";
    const assistantMessages = [];
    let outputTokens = 0;
    for (const member of conversation.members.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const contact = await this.contacts.resolve(userId, member.contactId);
      const text = await this.generateReply(conversation.id, input, contact.name, contact.tone, memoryContext);
      outputTokens += Math.ceil(text.length / 2);
      assistantMessages.push(await this.prisma.message.create({ data: { conversationId: conversation.id, role: "assistant", content: text, mode: input.mode } }));
    }
    await this.usage.consume(userId, { mode: input.mode, conversationId: conversation.id, messageId: assistantMessages[0]!.id, inputTokens, outputTokens });
    return { userMessage, assistantMessages, mode: input.mode, chargedTokens: input.mode === "token" ? inputTokens + outputTokens : 0, notice: "讨论组已按成员顺序回复，仅供娱乐参考。" };
  }

  private async generateReply(conversationId: string, input: SendMessageDto, name: string, tone: string, memoryContext: string) {
    const provider = input.mode === "free" ? (this.freeProvider === this.mockProvider ? new MockAiProvider(name) : this.freeProvider) : new MockAiProvider(name);
    let text = "";
    let failed = false;
    for await (const event of provider.generate({ conversationId, content: input.content, mode: input.mode, systemPrompt: `你是${name}，互动风格是${tone}。你只能提供娱乐和陪伴，不提供医疗、法律、财务或其他需要承担责任的具体建议。${memoryContext}` })) {
      if (event.type === "delta" && event.text) text += event.text;
      if (event.type === "failed") failed = true;
    }
    return !text || failed ? this.collectMockReply(conversationId, input.content, name) : text;
  }

  private async collectMockReply(conversationId: string, content: string, name: string) {
    let text = "";
    for await (const event of this.mockProvider.generate({ conversationId, content, mode: "free" })) if (event.type === "delta" && event.text) text += event.text;
    return text.replace("心屿 AI", name);
  }

  private async getOwnedConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId }, include: { messages: { orderBy: { createdAt: "asc" } }, members: { orderBy: { sortOrder: "asc" } } } });
    if (!conversation) throw new NotFoundException("找不到该对话");
    return conversation;
  }
}
