"use client";

import React from "react";
import type { Message } from "../../lib/chat-api";
import type { Contact } from "../../lib/contacts-api";
import type { SkillCard } from "../../lib/skills-api";
import { SkillResultCard } from "../skills/skill-result-card";

type MessageBubbleProps = {
  message: Message;
  sender?: Contact;
  quotedContent?: string;
  onQuote: (message: Message) => void;
  onRegenerate: (message: Message) => void;
  onContinue: (message: Message) => void;
  onRememberSkill?: (message: Message, card: SkillCard) => void | Promise<void>;
};

export function MessageBubble({
  message,
  sender,
  quotedContent,
  onQuote,
  onRegenerate,
  onContinue,
  onRememberSkill
}: MessageBubbleProps) {
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(message.content);
    } catch {
      // Clipboard availability is browser-controlled; the message remains selectable.
    }
  };

  return (
    <article className={`message-bubble ${message.role}`} aria-label={message.role === "user" ? "你的消息" : `${sender?.name ?? "AI"}的消息`}>
      {message.role === "assistant" && sender && (
        <div className="message-sender">
          <span className="message-avatar" aria-hidden="true">{sender.avatar}</span>
          <b>{sender.name}</b>
        </div>
      )}
      {quotedContent && <blockquote>{quotedContent}</blockquote>}
      <p>{message.content}</p>
      {skillCardFromMetadata(message.metadata) && <SkillResultCard card={skillCardFromMetadata(message.metadata)!} onRemember={onRememberSkill ? () => onRememberSkill(message, skillCardFromMetadata(message.metadata)!) : undefined} />}
      <div className="message-actions" aria-label="消息操作">
        <button type="button" onClick={() => void copy()}>复制</button>
        <button type="button" onClick={() => onQuote(message)}>引用</button>
        {message.role === "assistant" && (
          <>
            <button type="button" onClick={() => onRegenerate(message)}>重新生成</button>
            <button type="button" onClick={() => onContinue(message)}>以此继续聊</button>
          </>
        )}
      </div>
    </article>
  );
}

function skillCardFromMetadata(metadata: Message["metadata"]): SkillCard | undefined {
  const candidate = metadata?.skillCard;
  if (!candidate || typeof candidate !== "object") return undefined;
  const card = candidate as Partial<SkillCard>;
  return typeof card.skill === "string" && typeof card.title === "string" && typeof card.summary === "string" && card.disclaimer === "趣味解读，仅供娱乐参考" && Array.isArray(card.actions)
    ? card as SkillCard
    : undefined;
}
