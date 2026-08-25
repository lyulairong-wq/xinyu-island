"use client";

import React, { FormEvent, useState } from "react";
import { skillDefinitions } from "../../lib/skills-api";
import type { Contact, SkillCode } from "../../lib/contacts-api";

export type ContactProfileDraft = {
  name: string;
  tagline?: string;
  description?: string;
  tone?: string;
  skillCodes: SkillCode[];
  primarySkill: SkillCode;
};

type ContactEditorProps = {
  onCreate: (draft: ContactProfileDraft) => void | Promise<void>;
  onCancel: () => void;
  contact?: Contact;
  submitLabel?: string;
};

const skills: SkillCode[] = ["tarot", "mbti", "zodiac", "ziwei", "meihua"];

export function ContactEditor({ onCreate, onCancel, contact, submitLabel = "创建联系人" }: ContactEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<SkillCode[]>(contact?.skills ?? ["tarot"]);
  const [primarySkill, setPrimarySkill] = useState<SkillCode>(contact?.primarySkill ?? contact?.skills[0] ?? "tarot");

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
        tone: optional("tone"), skillCodes: selected, primarySkill
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="contact-editor" onSubmit={(event) => void submit(event)} aria-label={contact ? "编辑私有 AI" : "新建私有 AI"}>
      <h3>{contact ? "编辑私有 AI" : "新建私有 AI"}</h3>
      <p>选择 1–3 项平台审核技能，并指定主技能。</p>
      <label>名称<input name="name" defaultValue={contact?.name} maxLength={40} required /></label>
      <label>一句介绍<input name="tagline" defaultValue={contact?.tagline} maxLength={80} /></label>
      <label>角色描述<textarea name="description" defaultValue={contact?.description} maxLength={300} /></label>
      <label>对话语气<input name="tone" defaultValue={contact?.tone} maxLength={40} /></label>
      <fieldset><legend>可用技能</legend>{skills.map((skill) => <label key={skill}><input type="checkbox" checked={selected.includes(skill)} disabled={!selected.includes(skill) && selected.length >= 3} onChange={(event) => setSelected((current) => {
        const next = event.target.checked ? [...current, skill] : current.filter((item) => item !== skill);
        if (!next.includes(primarySkill) && next[0]) setPrimarySkill(next[0]);
        return next;
      })} />{skillDefinitions([skill])[0]!.title}</label>)}</fieldset>
      <label>主技能<select value={primarySkill} onChange={(event) => setPrimarySkill(event.target.value as SkillCode)}>{selected.map((skill) => <option key={skill} value={skill}>{skillDefinitions([skill])[0]!.title}</option>)}</select></label>
      <div className="form-actions">
        <button className="quiet-button" type="button" onClick={onCancel}>取消</button>
        <button className="primary-button" type="submit" disabled={submitting || selected.length === 0}>{submitting ? "正在保存" : submitLabel}</button>
      </div>
    </form>
  );
}
