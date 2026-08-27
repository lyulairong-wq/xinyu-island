"use client";

import React, { FormEvent } from "react";
import type { GenerationMode, Message } from "../../lib/chat-api";
import type { StartSkillSessionInput } from "../../lib/skills-api";
import { SkillLauncher, type SkillLaunchOption } from "../skills/skill-launcher";

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
  skills?: readonly SkillLaunchOption[];
  onStartSkill?: (input: StartSkillSessionInput) => void | Promise<void>;
  tokenModeEnabled?: boolean;
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
  contactName,
  skills = [],
  onStartSkill,
  tokenModeEnabled = true
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
      <div className="message-composer">
        <SkillLauncher
          skills={skills}
          disabled={!onStartSkill}
          onStart={(input) => onStartSkill?.({ ...input, mode })}
        />
        <form className="message-composer-send" onSubmit={submit}>
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
      </div>
      <div className="composer-footer">
        <div className="mode-switch" aria-label="生成模式">
          <button type="button" className={mode === "free" ? "active" : ""} aria-pressed={mode === "free"} onClick={() => onModeChange("free")}>免费</button>
          {tokenModeEnabled && <button type="button" className={mode === "token" ? "active" : ""} aria-pressed={mode === "token"} onClick={() => onModeChange("token")}>Token</button>}
        </div>
        <span>{mode === "free" ? "使用免费额度" : "Token 模拟模式"}</span>
      </div>
    </div>
  );
}
