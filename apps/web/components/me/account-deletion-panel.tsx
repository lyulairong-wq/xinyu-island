"use client";

import React, { FormEvent, useState } from "react";
import { deleteAccount } from "../../lib/account-api";
import { operationalNotice } from "../../lib/api-client";

type AccountDeletionPanelProps = {
  onDeleted(): Promise<void>;
};

export function AccountDeletionPanel({ onDeleted }: AccountDeletionPanelProps) {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim() || !confirmed || submitting) return;

    setSubmitting(true);
    setNotice("");
    try {
      await deleteAccount({ password, confirmed: true });
      await onDeleted();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法注销账号，请稍后重试"));
      setSubmitting(false);
    }
  };

  return (
    <section className="me-section" aria-labelledby="account-deletion-heading">
      <h3 id="account-deletion-heading">注销账号</h3>
      <p>注销会永久删除账号及相关个人数据。</p>
      <form className="auth-form confirmation-panel" onSubmit={submit}>
        <label>
          当前密码
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          我理解注销后无法恢复
        </label>
        <button
          className="danger-button"
          type="submit"
          disabled={!password.trim() || !confirmed || submitting}
        >{submitting ? "正在注销…" : "立即注销账号"}</button>
        {notice && <p className="form-message" role="status">{notice}</p>}
      </form>
    </section>
  );
}
