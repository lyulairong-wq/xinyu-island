"use client";

import React, { useEffect, useMemo, useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import {
  createConversation as createConversationRequest,
  createGroup as createGroupRequest,
  deleteConversation as deleteConversationRequest,
  getConversation,
  sendMessage,
  updateConversation as updateConversationRequest,
  type ConversationDetail,
  type ConversationSummary,
  type CreateConversationResult,
  type CreateGroupResult,
  type GenerationMode,
  type Message,
  type SendMessageInput,
  type SendMessageResult,
  type UpdateConversationInput
} from "../../lib/chat-api";
import type { Contact } from "../../lib/contacts-api";
import { GroupCreator } from "../contacts/group-creator";
import { ConversationList, conversationTitle } from "./conversation-list";
import { ConversationPane } from "./conversation-pane";

type ChatShellProps = {
  conversations: ConversationSummary[];
  contacts?: Contact[];
  initialConversationId?: string;
  initialNotice?: string;
  welcomeName?: string;
  generationMode?: GenerationMode;
  onGenerationModeChange?: (mode: GenerationMode) => void;
  onConversationsChange?: () => void | Promise<void>;
  loadConversation?: (conversationId: string) => Promise<ConversationDetail>;
  send?: (conversationId: string, input: SendMessageInput) => Promise<SendMessageResult>;
  createDirect?: (contactId: string) => Promise<CreateConversationResult>;
  createDiscussionGroup?: (contactIds: string[]) => Promise<CreateGroupResult>;
  update?: (conversationId: string, input: UpdateConversationInput) => Promise<{
    id: string;
    title: string | null;
    memoryEnabled: boolean;
    archivedAt: string | null;
  }>;
  remove?: (conversationId: string) => Promise<{ success: true }>;
};

export function ChatShell({
  conversations,
  contacts = [],
  initialConversationId,
  initialNotice = "",
  welcomeName,
  generationMode,
  onGenerationModeChange,
  onConversationsChange,
  loadConversation = getConversation,
  send = sendMessage,
  createDirect = createConversationRequest,
  createDiscussionGroup = createGroupRequest,
  update = updateConversationRequest,
  remove = deleteConversationRequest
}: ChatShellProps) {
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId ?? "");
  const [details, setDetails] = useState<Record<string, ConversationDetail>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [quotes, setQuotes] = useState<Record<string, Message | null>>({});
  const [loadingId, setLoadingId] = useState("");
  const [generatingId, setGeneratingId] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [localMode, setLocalMode] = useState<GenerationMode>(generationMode ?? "free");
  const [newChatSurface, setNewChatSurface] = useState<"choose" | "direct" | "group" | null>(null);
  const mode = generationMode ?? localMode;

  useEffect(() => {
    if (initialConversationId) setActiveConversationId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    setNotice(initialNotice);
  }, [initialNotice]);

  useEffect(() => {
    if (!activeConversationId || details[activeConversationId]) return;
    let active = true;
    setLoadingId(activeConversationId);
    void loadConversation(activeConversationId)
      .then((detail) => {
        if (active) setDetails((current) => ({ ...current, [activeConversationId]: detail }));
      })
      .catch((error: unknown) => {
        if (active) setNotice(operationalNotice(error, "暂时无法打开对话"));
      })
      .finally(() => {
        if (active) setLoadingId((current) => current === activeConversationId ? "" : current);
      });
    return () => { active = false; };
  }, [activeConversationId, details, loadConversation]);

  const activeSummary = conversations.find((conversation) => conversation.id === activeConversationId);
  const activeDetail = details[activeConversationId];
  const activeContact = activeDetail?.contact ?? activeSummary?.contact;
  const activeKind = activeDetail?.kind ?? activeSummary?.kind;
  const members = useMemo(() => {
    if (activeKind !== "group") return activeContact ? [activeContact] : [];
    const memberRows = activeDetail?.members ?? [];
    const resolved = [...memberRows]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((member) => contacts.find((contact) => contact.id === member.contactId))
      .filter((contact): contact is Contact => Boolean(contact));
    return resolved.length > 0 ? resolved : activeContact ? [activeContact] : [];
  }, [activeContact, activeDetail?.members, activeKind, contacts]);

  const selectConversation = (conversation: ConversationSummary) => {
    setNotice("");
    setNewChatSurface(null);
    setActiveConversationId(conversation.id);
  };

  const refreshConversations = async () => {
    await onConversationsChange?.();
  };

  const archiveConversation = async (conversation: ConversationSummary) => {
    setNotice("");
    try {
      await update(conversation.id, { archived: true });
      if (activeConversationId === conversation.id) setActiveConversationId("");
      await refreshConversations();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法归档对话"));
    }
  };

  const removeConversation = async (conversation: ConversationSummary) => {
    setNotice("");
    try {
      await remove(conversation.id);
      if (activeConversationId === conversation.id) setActiveConversationId("");
      setDetails((current) => withoutKey(current, conversation.id));
      setDrafts((current) => withoutKey(current, conversation.id));
      setQuotes((current) => withoutKey(current, conversation.id));
      await refreshConversations();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法删除对话"));
    }
  };

  const updateMessages = (conversationId: string, append: Message[]) => {
    setDetails((current) => {
      const base = current[conversationId] ?? summaryToDetail(conversations.find((item) => item.id === conversationId));
      if (!base) return current;
      return {
        ...current,
        [conversationId]: { ...base, messages: [...base.messages, ...append] }
      };
    });
  };

  const performSend = async (content: string, quoteMessageId?: string, clearComposer = true) => {
    if (!activeConversationId || generatingId) return;
    const conversationId = activeConversationId;
    if (clearComposer) {
      setDrafts((current) => ({ ...current, [conversationId]: "" }));
      setQuotes((current) => ({ ...current, [conversationId]: null }));
    }
    setNotice("");
    setGeneratingId(conversationId);
    try {
      const result = await send(conversationId, {
        content,
        mode,
        ...(quoteMessageId ? { quoteMessageId } : {})
      });
      const replies = result.assistantMessages ?? (result.assistantMessage ? [result.assistantMessage] : []);
      updateMessages(conversationId, [result.userMessage, ...replies]);
      setNotice(result.notice);
      await refreshConversations();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法发送消息"));
    } finally {
      setGeneratingId((current) => current === conversationId ? "" : current);
    }
  };

  const regenerate = (message: Message) => {
    const messages = activeDetail?.messages ?? [];
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const source = messages.slice(0, messageIndex).reverse().find((item) => item.role === "user");
    if (!source) {
      setNotice("找不到可重新生成的用户消息");
      return;
    }
    void performSend(source.content, source.quotedMessageId ?? undefined, false);
  };

  const continueFrom = (message: Message) => {
    void performSend("请继续。", message.id, false);
  };

  const toggleMemory = async () => {
    if (!activeConversationId) return;
    const current = activeDetail?.memoryEnabled ?? activeSummary?.memoryEnabled ?? false;
    try {
      const changed = await update(activeConversationId, { memoryEnabled: !current });
      setDetails((all) => {
        const base = all[activeConversationId] ?? summaryToDetail(activeSummary);
        return base ? { ...all, [activeConversationId]: { ...base, memoryEnabled: changed.memoryEnabled } } : all;
      });
      await refreshConversations();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法更新记忆设置"));
    }
  };

  const changeMode = (nextMode: GenerationMode) => {
    if (onGenerationModeChange) onGenerationModeChange(nextMode);
    else setLocalMode(nextMode);
  };

  const startDirect = async (contact: Contact) => {
    setNotice("");
    try {
      const created = await createDirect(contact.id);
      const detail = newDirectDetail(created, contact);
      setDetails((current) => ({ ...current, [created.id]: detail }));
      setActiveConversationId(created.id);
      setNewChatSurface(null);
      await refreshConversations();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法创建对话"));
    }
  };

  const startGroup = async (contactIds: string[]) => {
    setNotice("");
    try {
      const created = await createDiscussionGroup(contactIds.slice(0, 3));
      const detail = newGroupDetail(created);
      setDetails((current) => ({ ...current, [created.id]: detail }));
      setActiveConversationId(created.id);
      setNewChatSurface(null);
      await refreshConversations();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法创建讨论组"));
    }
  };

  const title = activeSummary
    ? conversationTitle(activeSummary)
    : activeDetail?.title?.trim() || (activeKind === "group" ? "多人讨论组" : activeContact?.name ?? "对话");

  return (
    <div className={`chat-workspace ${newChatSurface ? "new-chat-open" : activeConversationId ? "show-conversation" : "show-list"}`}>
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={selectConversation}
        onArchive={archiveConversation}
        onDelete={removeConversation}
        onNewChat={() => setNewChatSurface("choose")}
      />
      {newChatSurface ? (
        <NewChatSurface
          surface={newChatSurface}
          contacts={contacts}
          onChoose={setNewChatSurface}
          onDirect={startDirect}
          onGroup={startGroup}
          onCancel={() => setNewChatSurface(null)}
        />
      ) : activeConversationId && activeContact && activeKind ? (
        <ConversationPane
          title={title}
          kind={activeKind}
          contact={activeContact}
          members={members}
          messages={activeDetail?.messages ?? []}
          draft={drafts[activeConversationId] ?? ""}
          quote={quotes[activeConversationId]}
          mode={mode}
          memoryEnabled={activeDetail?.memoryEnabled ?? activeSummary?.memoryEnabled ?? false}
          generating={generatingId === activeConversationId}
          notice={loadingId === activeConversationId ? "正在加载对话…" : notice}
          onDraftChange={(draft) => setDrafts((current) => ({ ...current, [activeConversationId]: draft }))}
          onSend={(content) => void performSend(content, quotes[activeConversationId]?.id)}
          onModeChange={changeMode}
          onQuote={(message) => setQuotes((current) => ({ ...current, [activeConversationId]: message }))}
          onClearQuote={() => setQuotes((current) => ({ ...current, [activeConversationId]: null }))}
          onRegenerate={regenerate}
          onContinue={continueFrom}
          onToggleMemory={() => void toggleMemory()}
          onBack={() => setActiveConversationId("")}
        />
      ) : (
        <section className="chat-empty-pane">
          <span className="welcome-orb" aria-hidden="true">✦</span>
          <h2>{welcomeName ? `欢迎来到心屿，${welcomeName}` : "选择一段对话"}</h2>
          <p>从最近对话继续，或新建单聊和讨论组。</p>
          {notice && <p className="chat-operation-state" role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}

function NewChatSurface({ surface, contacts, onChoose, onDirect, onGroup, onCancel }: {
  surface: "choose" | "direct" | "group";
  contacts: Contact[];
  onChoose: (surface: "direct" | "group") => void;
  onDirect: (contact: Contact) => void | Promise<void>;
  onGroup: (contactIds: string[]) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <section className="new-chat-surface" aria-label="新建对话">
      {surface === "choose" && (
        <>
          <h2>新建对话</h2>
          <p>先选择对话类型。</p>
          <div className="new-chat-choices">
            <button type="button" onClick={() => onChoose("direct")}><b>单聊</b><span>选择一位 AI 联系人</span></button>
            <button type="button" onClick={() => onChoose("group")}><b>创建讨论组</b><span>选择 2–3 位 AI 联系人</span></button>
          </div>
        </>
      )}
      {surface === "direct" && (
        <>
          <h2>选择单聊联系人</h2>
          <div className="direct-contact-picker">
            {contacts.map((contact) => (
              <button type="button" key={contact.id} onClick={() => void onDirect(contact)} aria-label={`与${contact.name}单聊`}>
                <span className="contact-avatar" aria-hidden="true">{contact.avatar}</span>
                <span><b>{contact.name}</b><small>{contact.tagline}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      {surface === "group" && <GroupCreator contacts={contacts} onCreate={onGroup} />}
      <button className="quiet-button" type="button" onClick={onCancel}>返回</button>
    </section>
  );
}

function summaryToDetail(summary?: ConversationSummary): ConversationDetail | undefined {
  if (!summary) return undefined;
  return {
    id: summary.id,
    contactId: summary.contactId,
    kind: summary.kind,
    title: summary.title,
    memoryEnabled: summary.memoryEnabled,
    archivedAt: summary.archivedAt,
    updatedAt: summary.updatedAt,
    contact: summary.contact,
    messages: [],
    members: []
  };
}

function newDirectDetail(created: CreateConversationResult, contact: Contact): ConversationDetail {
  return {
    id: created.id,
    contactId: contact.id,
    kind: "single",
    title: null,
    memoryEnabled: created.memoryEnabled,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
    contact,
    messages: [],
    members: []
  };
}

function newGroupDetail(created: CreateGroupResult): ConversationDetail {
  const first = created.members[0]!;
  return {
    id: created.id,
    contactId: first.id,
    kind: "group",
    title: "多人讨论组",
    memoryEnabled: created.memoryEnabled,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
    contact: first,
    messages: [],
    members: created.members.map((contact, sortOrder) => ({ id: `${created.id}-${contact.id}`, contactId: contact.id, sortOrder }))
  };
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
