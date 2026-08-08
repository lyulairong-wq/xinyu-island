import { Injectable, NotFoundException } from "@nestjs/common";
import { MockAiProvider, OpenAiCompatibleProvider, type AiProvider } from "@xinyu/ai";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OFFICIAL_CONTACTS } from "../contacts/official-contacts";
import type { SendMessageDto } from "./dto/send-message.dto";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; mode?: "free" | "token"; createdAt: Date };

@Injectable()
export class ChatService {
  private readonly mockProvider = new MockAiProvider();
  private readonly freeProvider: AiProvider;

  constructor(private readonly prisma: PrismaService) {
    const endpoint = process.env.FREE_MODEL_BASE_URL;
    const model = process.env.FREE_MODEL_NAME;
    this.freeProvider = endpoint && model ? new OpenAiCompatibleProvider(endpoint, model, Number(process.env.FREE_MODEL_TIMEOUT_MS ?? 30_000)) : this.mockProvider;
  }

  async createConversation(userId: string, contactId: string) {
    const contact = OFFICIAL_CONTACTS.find((item) => item.id === contactId);
    if (!contact) throw new NotFoundException("找不到该 AI 联系人");
    const conversation = await this.prisma.conversation.create({ data: { userId, contactId, kind: "single" } });
    return { id: conversation.id, contact };
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.getOwnedConversation(userId, conversationId);
    return { ...conversation, contact: OFFICIAL_CONTACTS.find((item) => item.id === conversation.contactId) };
  }

  async sendMessage(userId: string, conversationId: string, input: SendMessageDto) {
    const conversation = await this.getOwnedConversation(userId, conversationId);
    const contact = OFFICIAL_CONTACTS.find((item) => item.id === conversation.contactId);
    if (!contact) throw new NotFoundException("找不到该 AI 联系人");
    const userMessage = await this.prisma.message.create({ data: { conversationId, role: "user", content: input.content.trim(), mode: input.mode } });
    const provider = input.mode === "free"
      ? (this.freeProvider === this.mockProvider ? new MockAiProvider(contact.name) : this.freeProvider)
      : new MockAiProvider(contact.name);
    let text = "";
    let failed = false;
    for await (const event of provider.generate({ conversationId, content: input.content, mode: input.mode, systemPrompt: `你是${contact.name}，你的互动风格是${contact.tone}。你只能提供娱乐和陪伴，不提供医疗、法律、财务或其他需要承担责任的具体建议。` })) {
      if (event.type === "delta" && event.text) text += event.text;
      if (event.type === "failed") failed = true;
    }
    if (!text || failed) text = await this.collectMockReply(conversationId, input.content, contact.name);
    const assistantMessage = await this.prisma.message.create({ data: { conversationId, role: "assistant", content: text, mode: input.mode } });
    const notice = input.mode === "free"
      ? (this.freeProvider === this.mockProvider ? "当前使用免费 Mock 回复，仅供娱乐参考。" : "当前使用免费开源模型回复，仅供娱乐参考。")
      : "Token 模式接口已预留，当前未产生 Token 消耗，仅供娱乐参考。";
    return { userMessage, assistantMessage, mode: input.mode, chargedTokens: 0, notice };
  }

  private async collectMockReply(conversationId: string, content: string, name: string) {
    let text = "";
    for await (const event of this.mockProvider.generate({ conversationId, content, mode: "free" })) if (event.type === "delta" && event.text) text += event.text;
    return text.replace("心屿 AI", name);
  }

  private async getOwnedConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    if (!conversation) throw new NotFoundException("找不到该对话");
    return conversation;
  }
}
