"use client";

import React, { FormEvent } from "react";
import type { GenerationMode, Message } from "../../lib/chat-api";

type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  quote?: Message | null;
  onClearQuote: () => void;
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  generating?: boolean;
  notice?: string;
  contactName: string;
};

export function MessageComposer({
  value,
  onChange,
  onSend,
  quote,
  onClearQuote,
  mode,
  onModeChange,
  generating = false,
  notice,
  contactName
}: MessageComposerProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (generating || !value.trim()) return;
    onSend(value.trim());
  };

  return (
    <div className="composer-area">
      {(generating || notice) && (
        <div className="chat-operation-state" aria-live="polite">
          <p role="status">{generating ? `${contactName}正在输入…` : notice}</p>
        </div>
      )}
      {quote && (
        <div className="composer-quote">
          <span><b>引用消息</b><small>{quote.content}</small></span>
          <button type="button" aria-label="取消引用" onClick={onClearQuote}>×</button>
        </div>
      )}
      <form className="message-composer" onSubmit={submit}>
        <button className="composer-plus" type="button" aria-label="更多功能" title="技能入口将在后续任务接入" disabled>＋</button>
        <textarea
          aria-label="消息"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`和 ${contactName} 说点什么…`}
          maxLength={4000}
          rows={2}
        />
        <button className="send-button" type="submit" disabled={generating || !value.trim()}>发送</button>
      </form>
      <div className="composer-footer">
        <div className="mode-switch" aria-label="生成模式">
          <button type="button" className={mode === "free" ? "active" : ""} aria-pressed={mode === "free"} onClick={() => onModeChange("free")}>免费</button>
          <button type="button" className={mode === "token" ? "active" : ""} aria-pressed={mode === "token"} onClick={() => onModeChange("token")}>Token</button>
        </div>
        <span>{mode === "free" ? "使用免费额度" : "Token 模拟模式"}</span>
      </div>
    </div>
  );
}
