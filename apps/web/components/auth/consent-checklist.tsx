"use client";

import React from "react";

export type ConsentType = "terms" | "privacy" | "entertainment_notice";

export type ConsentSelection = Record<ConsentType, boolean>;

const CONSENT_DOCUMENTS: Array<{ type: ConsentType; label: string; href: string }> = [
  { type: "terms", label: "用户协议（内部封闭测试版 v1.0）", href: "#internal-closed-beta-terms-v1" },
  { type: "privacy", label: "隐私政策（内部封闭测试版 v1.0）", href: "#internal-closed-beta-privacy-v1" },
  { type: "entertainment_notice", label: "娱乐使用提示（内部封闭测试版 v1.0）", href: "#internal-closed-beta-entertainment-notice-v1" }
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
  return <div className="consent-list" aria-label="注册所需同意项">
    {CONSENT_DOCUMENTS.map(({ type, label, href }) => <label className="checkbox-row" key={type}>
      <input
        type="checkbox"
        checked={value[type]}
        onChange={(event) => onChange({ ...value, [type]: event.target.checked })}
      />
      我已阅读并同意 <a href={href}>{label}</a>
    </label>)}
  </div>;
}
