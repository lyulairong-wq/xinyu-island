"use client";

import React, { FormEvent, useState } from "react";
import type { SkillDefinition, SkillInputCode } from "../../lib/skills-api";

export type SkillInputValues = {
  topic?: string;
  answers?: string[];
  monthDay?: string;
  birthDate?: string;
  birthTimePeriod?: string;
  number?: number;
};

type SkillInputFlowProps = {
  skill: SkillDefinition;
  onSubmit: (values: SkillInputValues) => void | Promise<void>;
  onCancel: () => void;
  pending?: boolean;
  notice?: string;
};

const labels: Record<SkillInputCode, string> = {
  topic: "想聊的主题",
  answers: "你的选择",
  monthDay: "生日（月日）",
  birthDate: "出生日期（可选）",
  birthTimePeriod: "出生时段（可选）",
  number: "选择一个数字"
};

export function SkillInputFlow({ skill, onSubmit, onCancel, pending = false, notice }: SkillInputFlowProps) {
  const [values, setValues] = useState<SkillInputValues>({});
  const allInputs = [...skill.requiredInputs, ...(skill.optionalInputs ?? [])];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(values);
  };

  return (
    <form className="skill-input-flow" aria-label={`${skill.title}最少信息`} onSubmit={submit}>
      {notice && <p className="skill-input-notice" role="status">{notice}</p>}
      <p>{skill.summary}</p>
      {allInputs.map((input) => (
        <label key={input}>
          <span>{labels[input]}{skill.requiredInputs.includes(input) ? "" : "（可选）"}</span>
          {input === "answers" ? (
            <textarea
              aria-label={labels[input]}
              placeholder="用逗号分隔你的选择"
              onChange={(event) => setValues((current) => ({ ...current, answers: event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean) }))}
            />
          ) : input === "number" ? (
            <input aria-label={labels[input]} type="number" inputMode="numeric" onChange={(event) => setValues((current) => ({ ...current, number: Number(event.target.value) }))} />
          ) : (
            <input aria-label={labels[input]} type={input === "birthDate" ? "date" : "text"} onChange={(event) => setValues((current) => ({ ...current, [input]: event.target.value }))} />
          )}
        </label>
      ))}
      <small>不想填写也没关系，可以回到普通聊天继续说。</small>
      <div className="form-actions">
        <button type="button" onClick={onCancel}>回到聊天</button>
        <button type="submit" className="primary-button" disabled={pending}>{pending ? "正在生成…" : "开始解读"}</button>
      </div>
    </form>
  );
}
