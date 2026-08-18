"use client";

import React from "react";
import type { GenerationMode, Message } from "../../lib/chat-api";
import type { Contact } from "../../lib/contacts-api";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import type { StartSkillSessionInput } from "../../lib/skills-api";
import type { SkillLaunchOption } from "../skills/skill-launcher";

type ConversationPaneProps = {
  title: string;
  kind: "single" | "group";
  contact: Contact;
  members: Contact[];
  messages: Message[];
  draft: string;
  quote?: Message | null;
  mode: GenerationMode;
  memoryEnabled: boolean;
  generating?: boolean;
  notice?: string;
  onDraftChange: (draft: string) => void;
  onSend: (content: string) => void;
  onModeChange: (mode: GenerationMode) => void;
  onQuote: (message: Message) => void;
  onClearQuote?: () => void;
  onRegenerate: (message: Message) => void;
  onContinue: (message: Message) => void;
  onToggleMemory: () => void;
  onBack: () => void;
  skills?: readonly SkillLaunchOption[];
  onStartSkill?: (input: StartSkillSessionInput) => void | Promise<void>;
  onRememberSkill?: (message: Message) => void | Promise<void>;
};

export function ConversationPane({
  title,
  kind,
  contact,
  members,
  messages,
  draft,
  quote,
  mode,
  memoryEnabled,
  generating = false,
  notice,
  onDraftChange,
  onSend,
  onModeChange,
  onQuote,
  onClearQuote = () => undefined,
  onRegenerate,
  onContinue,
  onToggleMemory,
  onBack,
  skills = [],
  onStartSkill,
  onRememberSkill
}: ConversationPaneProps) {
  const contentById = new Map(messages.map((message) => [message.id, message.content]));
  let assistantOrder = 0;

  return (
    <section className="conversation-pane" aria-label={title}>
      <header className="conversation-pane-header">
        <button className="mobile-back-button" type="button" onClick={onBack} aria-label="返回对话列表">‹</button>
        <span className="contact-avatar" aria-hidden="true">{kind === "group" ? "组" : contact.avatar}</span>
        <div className="conversation-heading-copy">
          <h2>{title}</h2>
          <p>{kind === "group" ? `${members.length} 位 AI · 按成员顺序回复` : contact.tagline}</p>
        </div>
        <button className={`memory-toggle ${memoryEnabled ? "on" : ""}`} type="button" onClick={onToggleMemory}>
          {memoryEnabled ? "记忆已开" : "记忆已关"}
        </button>
      </header>
      {messages.length === 0 ? (
        <div className="conversation-welcome">
          <span aria-hidden="true">✦</span>
          <h3>从一句简单的问候开始吧</h3>
          <p>技能入口已预留，将在后续任务接入。</p>
        </div>
      ) : (
        <ol className="message-list" aria-label="消息记录">
          {messages.map((message) => {
            if (message.role === "user") assistantOrder = 0;
            const sender = message.role === "assistant"
              ? kind === "group"
                ? members[assistantOrder++ % Math.max(members.length, 1)] ?? contact
                : contact
              : undefined;
            return (
              <li key={message.id}>
                <MessageBubble
                  message={message}
                  sender={sender}
                  quotedContent={message.quotedMessageId ? contentById.get(message.quotedMessageId) : undefined}
                  onQuote={onQuote}
                  onRegenerate={onRegenerate}
                  onContinue={onContinue}
                  onRememberSkill={onRememberSkill ? (rememberedMessage) => onRememberSkill(rememberedMessage) : undefined}
                />
              </li>
            );
          })}
        </ol>
      )}
      <MessageComposer
        value={draft}
        onChange={onDraftChange}
        onSend={onSend}
        quote={quote}
        onClearQuote={onClearQuote}
        mode={mode}
        onModeChange={onModeChange}
        generating={generating}
        notice={notice}
        contactName={kind === "group" ? title : contact.name}
        skills={skills}
        onStartSkill={onStartSkill}
      />
    </section>
  );
}
