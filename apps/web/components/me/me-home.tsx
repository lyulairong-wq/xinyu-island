"use client";

import React, { useEffect, useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import type { AuthUser } from "../../lib/auth-api";
import type { Contact } from "../../lib/contacts-api";
import { listDeletedContactRecords, updateDefaultMemory, type DeletedContactRecords } from "../../lib/contacts-api";
import { getUsageSummary, type UsageSummary } from "../../lib/usage-api";
import { AccountDeletionPanel } from "./account-deletion-panel";
import { ConsentDocuments } from "./consent-documents";
import { MemoryManager } from "./memory-manager";

type MeHomeProps = {
  user: AuthUser;
  contacts: Contact[];
  onLogout(): Promise<void>;
  onAccountDeleted(): Promise<void>;
  loadUsage?: () => Promise<UsageSummary>;
  saveDefaultMemory?: (enabled: boolean) => Promise<{ defaultMemoryEnabled: boolean }>;
  loadDeletedRecords?: () => Promise<DeletedContactRecords>;
};

export function MeHome({
  user,
  contacts,
  onLogout,
  onAccountDeleted,
  loadUsage = getUsageSummary,
  saveDefaultMemory = updateDefaultMemory,
  loadDeletedRecords = listDeletedContactRecords
}: MeHomeProps) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [notice, setNotice] = useState("");
  const [defaultMemoryEnabled, setDefaultMemoryEnabled] = useState(user.defaultMemoryEnabled);
  const [deletedRecords, setDeletedRecords] = useState<DeletedContactRecords | null>(null);

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

  const changeDefaultMemory = async (enabled: boolean) => {
    setNotice("");
    try {
      const result = await saveDefaultMemory(enabled);
      setDefaultMemoryEnabled(result.defaultMemoryEnabled);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法保存记忆设置"));
    }
  };

  const showDeletedRecords = async () => {
    setNotice("");
    try {
      setDeletedRecords(await loadDeletedRecords());
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法加载已删除 AI 记录"));
    }
  };

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
        <label><input type="checkbox" checked={defaultMemoryEnabled} onChange={(event) => void changeDefaultMemory(event.target.checked)} />新建单聊默认开启长期记忆</label>
        <p>仅影响之后新建的单聊；你仍可在每个对话中单独开关。</p>
        <MemoryManager contacts={contacts} />
      </section>

      <section className="me-section" aria-labelledby="privacy-heading">
        <h3 id="privacy-heading">隐私与安全</h3>
        <p>查看封闭测试期间的数据使用、安全边界与隐私说明。</p>
        <button className="quiet-button" type="button" onClick={() => void showDeletedRecords()}>已删除 AI 记录</button>
        {deletedRecords && <div className="deleted-records" aria-label="已删除 AI 记录">
          <p>保留记录仅供查看；如需彻底删除，请在对应聊天或记忆管理中操作。</p>
          <p>保留单聊：{deletedRecords.conversations.length} 条</p>
          <p>保留记忆：{deletedRecords.memories.length} 条</p>
        </div>}
      </section>

      <ConsentDocuments />

      <AccountDeletionPanel onDeleted={onAccountDeleted} />

      <section className="me-section" aria-labelledby="settings-heading">
        <h3 id="settings-heading">设置</h3>
        <button className="quiet-button" type="button" onClick={() => void onLogout()}>退出登录</button>
      </section>
    </div>
  );
}
