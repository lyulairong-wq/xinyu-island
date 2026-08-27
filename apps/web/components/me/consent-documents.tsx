"use client";

import React, { useEffect, useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import {
  getConsentDocuments,
  type ConsentDocumentWithGrant
} from "../../lib/account-api";

export function ConsentDocuments() {
  const [documents, setDocuments] = useState<ConsentDocumentWithGrant[] | null>(null);
  const [openedDocument, setOpenedDocument] = useState<ConsentDocumentWithGrant["type"] | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void getConsentDocuments()
      .then((result) => {
        if (active) setDocuments(result.documents);
      })
      .catch((error: unknown) => {
        if (active) setNotice(operationalNotice(error, "暂时无法加载协议，请稍后重试"));
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="me-section" aria-labelledby="consent-documents-heading">
      <h3 id="consent-documents-heading">协议和隐私</h3>
      <p>查看你已确认的协议版本和确认时间。</p>
      {documents === null && !notice && <p className="conversation-empty" role="status">正在加载协议…</p>}
      {notice && <p className="form-message" role="status">{notice}</p>}
      {documents?.length === 0 && <p className="conversation-empty">暂无可查看的协议。</p>}
      {documents?.map((document) => {
        const isOpen = openedDocument === document.type;
        return (
          <article className="consent-document" key={document.type}>
            <div>
              <h4>{document.title}</h4>
              <p>版本 {document.version}</p>
              <p><span>确认时间</span> {new Date(document.grantedAt).toLocaleString("zh-CN")}</p>
              {isOpen && <p>{document.content}</p>}
            </div>
            <button
              className="quiet-button"
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenedDocument(isOpen ? null : document.type)}
            >{isOpen ? "收起" : `查看${document.title}`}</button>
          </article>
        );
      })}
    </section>
  );
}
