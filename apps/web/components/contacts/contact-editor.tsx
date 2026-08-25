"use client";

import React, { FormEvent, useState } from "react";

export type ContactProfileDraft = {
  name: string;
  tagline?: string;
  description?: string;
  tone?: string;
};

type ContactEditorProps = {
  onCreate: (draft: ContactProfileDraft) => void | Promise<void>;
  onCancel: () => void;
};

export function ContactEditor({ onCreate, onCancel }: ContactEditorProps) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    setSubmitting(true);
    try {
      await onCreate({
        name: String(form.get("name") ?? "").trim(),
        tagline: optional("tagline"),
        description: optional("description"),
        tone: optional("tone")
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="contact-editor" onSubmit={(event) => void submit(event)} aria-label="新建私有 AI">
      <h3>新建私有 AI</h3>
      <p>先填写基础设定；技能配置入口将在后续任务接入。</p>
      <label>名称<input name="name" maxLength={40} required /></label>
      <label>一句介绍<input name="tagline" maxLength={80} /></label>
      <label>角色描述<textarea name="description" maxLength={300} /></label>
      <label>对话语气<input name="tone" maxLength={40} /></label>
      <div className="form-actions">
        <button className="quiet-button" type="button" onClick={onCancel}>取消</button>
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "正在创建" : "创建联系人"}</button>
      </div>
    </form>
  );
}
