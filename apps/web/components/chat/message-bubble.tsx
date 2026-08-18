"use client";

import React from "react";
import type { Message } from "../../lib/chat-api";
import type { Contact } from "../../lib/contacts-api";

type MessageBubbleProps = {
  message: Message;
  sender?: Contact;
  quotedContent?: string;
  onQuote: (message: Message) => void;
  onRegenerate: (message: Message) => void;
  onContinue: (message: Message) => void;
};

export function MessageBubble({
  message,
  sender,
  quotedContent,
  onQuote,
  onRegenerate,
  onContinue
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
