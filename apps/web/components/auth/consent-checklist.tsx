"use client";

import React, { useState } from "react";
import {
  CONSENT_DOCUMENTS,
  CURRENT_CONSENT_DOCUMENT_VERSION,
  type ConsentDocumentType
} from "@xinyu/contracts";

export type ConsentType = ConsentDocumentType;

export type ConsentSelection = Record<ConsentType, boolean>;

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
    .map(({ type }) => ({ type, version: CURRENT_CONSENT_DOCUMENT_VERSION }));
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
    {CONSENT_DOCUMENTS.map(({ type, title }) => <label className="checkbox-row" key={type}>
      <input
        type="checkbox"
        checked={value[type]}
        onChange={(event) => onChange({ ...value, [type]: event.target.checked })}
      />
      我已阅读并同意 <button className="consent-document-button" type="button" onClick={() => setOpenedDocument(type)}>{title}</button>
    </label>)}
    {opened && <section className="consent-document" role="dialog" aria-modal="false" aria-label={opened.title}>
      <div>
        <h3>{opened.title}</h3>
        <p>{opened.content}</p>
      </div>
      <button type="button" aria-label="关闭协议内容" onClick={() => setOpenedDocument(null)}>关闭</button>
    </section>}
  </div>;
}
