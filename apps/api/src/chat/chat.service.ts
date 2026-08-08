import { Injectable, NotFoundException } from "@nestjs/common";
import { MockAiProvider, OpenAiCompatibleProvider, type AiProvider } from "@xinyu/ai";
import { randomUUID } from "node:crypto";
import { OFFICIAL_CONTACTS } from "../contacts/official-contacts";
import type { SendMessageDto } from "./dto/send-message.dto";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; mode?: "free" | "token"; createdAt: string };
type Conversation = { id: string; userId: string; contactId: string; messages: ChatMessage[]; createdAt: string };

@Injectable()
export class ChatService {
  private readonly conversations = new Map<string, Conversation>();
  private readonly mockProvider = new MockAiProvider();
  private readonly freeProvider: AiProvider;

  constructor() {
    const endpoint = process.env.FREE_MODEL_BASE_URL;
    const model = process.env.FREE_MODEL_NAME;
    this.freeProvider = endpoint && model ? new OpenAiCompatibleProvider(endpoint, model, Number(process.env.FREE_MODEL_TIMEOUT_MS ?? 30_000)) : this.mockProvider;
  }

  createConversation(userId: string, contactId: string) {
    const contact = OFFICIAL_CONTACTS.find((item) => item.id === contactId);
    if (!contact) throw new NotFoundException("找不到该 AI 联系人");
    const conversation: Conversation = { id: randomUUID(), userId, contactId, messages: [], createdAt: new Date().toISOString() };
    this.conversations.set(conversation.id, conversation);
    return { id: conversation.id, contact };
  }

  getConversation(userId: string, conversationId: string) {
    const conversation = this.getOwnedConversation(userId, conversationId);
    return { ...conversation, contact: OFFICIAL_CONTACTS.find((item) => item.id === conversation.contactId) };
  }

  async sendMessage(userId: string, conversationId: string, input: SendMessageDto) {
    const conversation = this.getOwnedConversation(userId, conversationId);
    const contact = OFFICIAL_CONTACTS.find((item) => item.id === conversation.contactId);
    if (!contact) throw new NotFoundException("找不到该 AI 联系人");
    const now = new Date().toISOString();
    const userMessage: ChatMessage = { id: randomUUID(), role: "user", content: input.content.trim(), mode: input.mode, createdAt: now };
    const provider = input.mode === "free"
      ? (this.freeProvider === this.mockProvider ? new MockAiProvider(contact.name) : this.freeProvider)
      : new MockAiProvider(contact.name);
    const events = provider.generate({ conversationId, content: input.content, mode: input.mode, systemPrompt: `你是${contact.name}，你的互动风格是${contact.tone}。你只能提供娱乐和陪伴，不提供医疗、法律、财务或其他需要承担责任的具体建议。` });
    let text = "";
    let failed = false;
    for await (const event of events) {
      if (event.type === "delta" && event.text) text += event.text;
      if (event.type === "failed") failed = true;
    }
    if (!text || failed) {
      text = await this.collectMockReply(conversationId, input.content, contact.name);
    }
    const assistantMessage: ChatMessage = { id: randomUUID(), role: "assistant", content: text, mode: input.mode, createdAt: new Date().toISOString() };
    conversation.messages.push(userMessage, assistantMessage);
    const notice = input.mode === "free"
      ? (this.freeProvider === this.mockProvider ? "当前使用免费 Mock 回复，仅供娱乐参考。" : "当前使用免费开源模型回复，仅供娱乐参考。")
      : "Token 模式接口已预留，当前未产生 Token 消耗，仅供娱乐参考。";
    return { userMessage, assistantMessage, mode: input.mode, chargedTokens: 0, notice };
  }

  private async collectMockReply(conversationId: string, content: string, name: string) {
    let text = "";
    for await (const event of this.mockProvider.generate({ conversationId, content, mode: "free" })) {
      if (event.type === "delta" && event.text) text += event.text;
    }
    return text.replace("心屿 AI", name);
  }

  private getOwnedConversation(userId: string, conversationId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.userId !== userId) throw new NotFoundException("找不到该对话");
    return conversation;
  }
}
