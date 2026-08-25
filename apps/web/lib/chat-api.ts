import { authenticatedRequest, generationRequestId } from "./api-client";
import type { Contact } from "./contacts-api";

export type GenerationMode = "free" | "token";

export type Message = {
  id: string;
  conversationId?: string;
  quotedMessageId?: string | null;
  role: "user" | "assistant";
  content: string;
  mode: GenerationMode;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  contactId: string;
  kind: "single" | "group";
  title: string | null;
  memoryEnabled: boolean;
  archivedAt: string | null;
  updatedAt: string;
  contact: Contact;
  preview: string;
};

export type ConversationDetail = Omit<ConversationSummary, "preview"> & {
  messages: Message[];
  members: Array<{ id: string; contactId: string; sortOrder: number }>;
};

export type CreateConversationResult = {
  id: string;
  contact: Contact;
  memoryEnabled: boolean;
};

export type CreateGroupResult = {
  id: string;
  kind: "group";
  members: Contact[];
  memoryEnabled: boolean;
};

export type UpdateConversationInput = {
  memoryEnabled?: boolean;
  title?: string;
  archived?: boolean;
};

export type SendMessageInput = {
  content: string;
  mode: GenerationMode;
  memoryEnabled?: boolean;
  quoteMessageId?: string;
  requestId?: string;
};

export type SendMessageResult = {
  userMessage: Message;
  assistantMessage?: Message;
  assistantMessages?: Message[];
  mode: GenerationMode;
  chargedTokens: number;
  notice: string;
  provider?: string;
  providers?: string[];
  degraded?: boolean;
};

export function listConversations(includeArchived = false): Promise<ConversationSummary[]> {
  const query = includeArchived ? "?includeArchived=true" : "";
  return authenticatedRequest<ConversationSummary[]>(`/chat/conversations${query}`);
}

export function createConversation(contactId: string, memoryEnabled?: boolean): Promise<CreateConversationResult> {
  return authenticatedRequest<CreateConversationResult>("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ contactId, ...(memoryEnabled === undefined ? {} : { memoryEnabled }) })
  });
}

export function createGroup(contactIds: string[], memoryEnabled?: boolean): Promise<CreateGroupResult> {
  return authenticatedRequest<CreateGroupResult>("/chat/groups", {
    method: "POST",
    body: JSON.stringify({ contactIds, ...(memoryEnabled === undefined ? {} : { memoryEnabled }) })
  });
}

export function getConversation(conversationId: string): Promise<ConversationDetail> {
  return authenticatedRequest<ConversationDetail>(`/chat/conversations/${encodeURIComponent(conversationId)}`);
}

export function updateConversation(conversationId: string, input: UpdateConversationInput): Promise<{
  id: string;
  title: string | null;
  memoryEnabled: boolean;
  archivedAt: string | null;
}> {
  return authenticatedRequest(`/chat/conversations/${encodeURIComponent(conversationId)}/settings`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteConversation(conversationId: string): Promise<{ success: true }> {
  return authenticatedRequest<{ success: true }>(`/chat/conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE"
  });
}

export function sendMessage(conversationId: string, input: SendMessageInput): Promise<SendMessageResult> {
  const { requestId, ...payload } = input;
  return authenticatedRequest<SendMessageResult>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ ...payload, requestId: generationRequestId(requestId) })
  });
}

export function deleteMessage(conversationId: string, messageId: string): Promise<{ success: true }> {
  return authenticatedRequest<{ success: true }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE" }
  );
}
