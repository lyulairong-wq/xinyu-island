import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OFFICIAL_CONTACTS } from "../contacts/official-contacts";
import type { SendMessageDto } from "./dto/send-message.dto";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; mode?: "free" | "token"; createdAt: string };
type Conversation = { id: string; userId: string; contactId: string; messages: ChatMessage[]; createdAt: string };

@Injectable()
export class ChatService {
  private readonly conversations = new Map<string, Conversation>();

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

  sendMessage(userId: string, conversationId: string, input: SendMessageDto) {
    const conversation = this.getOwnedConversation(userId, conversationId);
    const contact = OFFICIAL_CONTACTS.find((item) => item.id === conversation.contactId);
    if (!contact) throw new NotFoundException("找不到该 AI 联系人");
    const now = new Date().toISOString();
    const userMessage: ChatMessage = { id: randomUUID(), role: "user", content: input.content.trim(), mode: input.mode, createdAt: now };
    const assistantMessage: ChatMessage = { id: randomUUID(), role: "assistant", content: this.mockReply(contact.name, input.content), mode: input.mode, createdAt: new Date().toISOString() };
    conversation.messages.push(userMessage, assistantMessage);
    return { userMessage, assistantMessage, mode: input.mode, chargedTokens: 0, notice: "当前为免费模式 Mock 回复，仅供娱乐参考。" };
  }

  private getOwnedConversation(userId: string, conversationId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.userId !== userId) throw new NotFoundException("找不到该对话");
    return conversation;
  }

  private mockReply(name: string, content: string) {
    const trimmed = content.trim();
    if (trimmed.includes("你好") || trimmed.includes("嗨")) return `你好，我是${name}。今天想从哪里开始聊？`;
    if (trimmed.endsWith("吗") || trimmed.includes("？")) return `我听见你的好奇了。关于“${trimmed.slice(0, 28)}”，我们可以先从你最在意的部分慢慢聊起。`;
    return `嗯，我在听。你刚刚提到“${trimmed.slice(0, 32)}”，这件事对你来说似乎有些特别。愿意再多说一点吗？`;
  }
}
