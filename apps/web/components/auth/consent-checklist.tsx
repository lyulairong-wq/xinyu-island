"use client";

import React, { useState } from "react";

export type ConsentType = "terms" | "privacy" | "entertainment_notice";

export type ConsentSelection = Record<ConsentType, boolean>;

const CONSENT_DOCUMENTS: Array<{ type: ConsentType; label: string; content: string }> = [
  { type: "terms", label: "用户协议（内部封闭测试版 v1.0）", content: "心屿当前为内部封闭测试产品，仅面向成年人提供娱乐与陪伴体验。AI 回复仅供娱乐参考，不构成医疗、法律、财务或其他专业意见；请勿将回复作为现实决策依据。" },
  { type: "privacy", label: "隐私政策（内部封闭测试版 v1.0）", content: "心屿仅为提供服务所需处理账号、对话与用户明确保存的记忆。长期记忆按“用户 × AI 联系人”隔离；你可在“我的 → 记忆管理”查看和删除已保存内容。请勿输入身份证、精确住址、联系方式等高敏感信息。" },
  { type: "entertainment_notice", label: "娱乐使用提示（内部封闭测试版 v1.0）", content: "塔罗、MBTI、星座、紫微斗数和梅花易数均属于趣味解读。结果不保证准确性，不作预测承诺，不提供现实行动指令；涉及医疗、法律、财务、伤害等高风险话题时，产品会转为安全回应。" }
];

export const EMPTY_CONSENT_SELECTION: ConsentSelection = {
  terms: false,
  privacy: false,
  entertainment_notice: false
};

export function isConsentSelectionComplete(value: ConsentSelection): boolean {
  return CONSENT_DOCUMENTS.every(({ type }) => value[type]);
}

export function buildConsentPayload(value: ConsentSelection): Array<{ type: ConsentType; version: "1.0" }> {
  return CONSENT_DOCUMENTS
    .filter(({ type }) => value[type])
    .map(({ type }) => ({ type, version: "1.0" }));
}

export function ConsentChecklist({
  value,
  onChange
}: {
  value: ConsentSelection;
  onChange(next: ConsentSelection): void;
}) {
  const [openedDocument, setOpenedDocument] = useState<ConsentType | null>(null);
  const opened = CONSENT_DOCUMENTS.find((document) => document.type === openedDocument);

  return <div className="consent-list" aria-label="注册所需同意项">
    {CONSENT_DOCUMENTS.map(({ type, label }) => <label className="checkbox-row" key={type}>
      <input
        type="checkbox"
        checked={value[type]}
        onChange={(event) => onChange({ ...value, [type]: event.target.checked })}
      />
      我已阅读并同意 <button className="consent-document-button" type="button" onClick={() => setOpenedDocument(type)}>{label}</button>
    </label>)}
    {opened && <section className="consent-document" role="dialog" aria-modal="false" aria-label={opened.label}>
      <div>
        <h3>{opened.label}</h3>
        <p>{opened.content}</p>
      </div>
      <button type="button" aria-label="关闭协议内容" onClick={() => setOpenedDocument(null)}>关闭</button>
    </section>}
  </div>;
}
