"use client";

import React, { useEffect, useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import type { AuthUser } from "../../lib/auth-api";
import type { Contact } from "../../lib/contacts-api";
import { getUsageSummary, type UsageSummary } from "../../lib/usage-api";
import { MemoryManager } from "./memory-manager";

type MeHomeProps = {
  user: AuthUser;
  contacts: Contact[];
  onLogout: () => Promise<void>;
  loadUsage?: () => Promise<UsageSummary>;
};

export function MeHome({ user, contacts, onLogout, loadUsage = getUsageSummary }: MeHomeProps) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void loadUsage()
      .then((summary) => {
        if (active) setUsage(summary);
      })
      .catch((error: unknown) => {
        if (active) setNotice(operationalNotice(error, "暂时无法加载用量"));
      });
    return () => { active = false; };
  }, [loadUsage]);

  return (
    <div className="module-page me-home">
      <section className="me-section" aria-labelledby="account-usage-heading">
        <h3 id="account-usage-heading">账号与用量</h3>
        <p>{user.nickname} · {user.email}</p>
        {usage && (
          <div className="usage-summary">
            <div><span>免费额度</span><strong>{usage.free.remaining.toLocaleString()} / {usage.free.limit.toLocaleString()}</strong></div>
            <div><span>Token 模拟用量</span><strong>{usage.token.paidBalance.toLocaleString()}</strong></div>
            <small>免费额度重置于 {new Date(usage.free.resetAt).toLocaleDateString("zh-CN")}</small>
          </div>
        )}
        {notice && <p className="form-message" role="status">{notice}</p>}
      </section>

      <section className="me-section" aria-labelledby="memory-heading">
        <h3 id="memory-heading">记忆管理</h3>
        <p>长期记忆仅用于对应的 AI 联系人，不会跨联系人共享。</p>
        <MemoryManager contacts={contacts} />
      </section>

      <section className="me-section" aria-labelledby="privacy-heading">
        <h3 id="privacy-heading">隐私与安全</h3>
        <p>查看封闭测试期间的数据使用、安全边界与隐私说明。</p>
      </section>

      <section className="me-section" aria-labelledby="agreement-heading">
        <h3 id="agreement-heading">用户协议</h3>
        <p>用户协议与娱乐使用提示可持续查看；普通聊天中不重复弹出。</p>
      </section>

      <section className="me-section" aria-labelledby="settings-heading">
        <h3 id="settings-heading">设置</h3>
        <button className="quiet-button" type="button" onClick={() => void onLogout()}>退出登录</button>
      </section>
    </div>
  );
}
