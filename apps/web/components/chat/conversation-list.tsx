"use client";

import React, { useMemo, useState } from "react";
import type { ConversationSummary } from "../../lib/chat-api";

type ConversationListProps = {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onSelect: (conversation: ConversationSummary) => void;
  onArchive: (conversation: ConversationSummary) => void | Promise<void>;
  onDelete: (conversation: ConversationSummary) => void | Promise<void>;
  onNewChat: () => void;
};

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onArchive,
  onDelete,
  onNewChat
}: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ConversationSummary | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<ConversationSummary | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return [...conversations]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .filter((conversation) => {
        if (!normalized) return true;
        const fields = [
          conversation.contact.name,
          conversation.title ?? "",
          conversation.kind === "group" ? "讨论组 群聊" : "单聊"
        ];
        return fields.some((field) => field.toLocaleLowerCase("zh-CN").includes(normalized));
      });
  }, [conversations, query]);

  return (
    <aside className="conversation-sidebar" aria-label="最近对话">
      <div className="conversation-list-heading">
        <div><p className="eyebrow">CHAT</p><h2>最近对话</h2></div>
        <button className="new-chat-button" type="button" onClick={onNewChat}>新建</button>
      </div>
      <label className="conversation-search">
        <span className="sr-only">搜索对话</span>
        <input
          type="search"
          aria-label="搜索对话"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索联系人、讨论组或标题"
        />
      </label>
      <div className="conversation-list-items">
        {filtered.map((conversation) => {
          const title = conversationTitle(conversation);
          return (
            <article className={`conversation-list-item ${activeConversationId === conversation.id ? "selected" : ""}`} key={conversation.id}>
              <button className="conversation-select" type="button" aria-label={title} onClick={() => onSelect(conversation)}>
                <span className="contact-avatar" aria-hidden="true">{conversation.kind === "group" ? "组" : conversation.contact.avatar}</span>
                <span className="conversation-list-copy">
                  <b>{title}</b>
                  <small>{conversation.preview}</small>
                </span>
                <time dateTime={conversation.updatedAt}>{formatRecentDate(conversation.updatedAt)}</time>
              </button>
              <div className="conversation-actions">
                <button type="button" aria-label={`归档 ${title}`} onClick={() => { setDeleteCandidate(null); setArchiveCandidate(conversation); }}>归档</button>
                <button type="button" aria-label={`删除 ${title}`} onClick={() => { setArchiveCandidate(null); setDeleteCandidate(conversation); }}>删除</button>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && <p className="conversation-list-empty">没有匹配的对话</p>}
      </div>
      {deleteCandidate && (
        <div className="confirmation-panel conversation-confirmation" role="alertdialog" aria-label={`删除 ${conversationTitle(deleteCandidate)}`}>
          <p>仅删除聊天记录；用量流水和联系人长期记忆会保留。</p>
          <div className="form-actions">
            <button className="quiet-button" type="button" onClick={() => setDeleteCandidate(null)}>取消</button>
            <button
              className="danger-button"
              type="button"
              aria-label={`确认删除 ${conversationTitle(deleteCandidate)}`}
              onClick={() => {
                void onDelete(deleteCandidate);
                setDeleteCandidate(null);
              }}
            >确认删除</button>
          </div>
        </div>
      )}
      {archiveCandidate && (
        <div className="confirmation-panel conversation-confirmation" role="alertdialog" aria-label={`归档 ${conversationTitle(archiveCandidate)}`}>
          <p>归档后会从最近对话中隐藏；聊天记录、用量流水和联系人长期记忆会保留。</p>
          <div className="form-actions">
            <button className="quiet-button" type="button" onClick={() => setArchiveCandidate(null)}>取消</button>
            <button
              className="primary-button"
              type="button"
              aria-label={`确认归档 ${conversationTitle(archiveCandidate)}`}
              onClick={() => {
                void onArchive(archiveCandidate);
                setArchiveCandidate(null);
              }}
            >确认归档</button>
          </div>
        </div>
      )}
    </aside>
  );
}

export function conversationTitle(conversation: ConversationSummary): string {
  const customTitle = conversation.title?.trim();
  if (customTitle) return customTitle;
  return conversation.kind === "group" ? `${conversation.contact.name}讨论组` : conversation.contact.name;
}

function formatRecentDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
}
