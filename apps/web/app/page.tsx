"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { AppsHome } from "../components/apps/apps-home";
import { AuthGate } from "../components/auth/auth-gate";
import { ChatShell } from "../components/chat/chat-shell";
import {
  buildConsentPayload,
  ConsentChecklist,
  EMPTY_CONSENT_SELECTION,
  isConsentSelectionComplete,
  type ConsentSelection
} from "../components/auth/consent-checklist";
import { ContactsHome } from "../components/contacts/contacts-home";
import { MeHome } from "../components/me/me-home";
import { AppNavigation, type AppDestination } from "../components/navigation/app-navigation";
import { operationalNotice } from "../lib/api-client";
import { login, logout, register, type AuthUser } from "../lib/auth-api";
import { getBrowserTokenStorage } from "../lib/auth-session";
import {
  createConversation,
  listConversations,
  type ConversationSummary,
  type CreateGroupResult,
  type GenerationMode
} from "../lib/chat-api";
import { listContacts, type Contact } from "../lib/contacts-api";

export default function HomePage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");

  const handleLogout = async () => {
    const storage = getBrowserTokenStorage();
    const token = storage?.read();
    try {
      if (token) await logout(token);
    } catch {
      // Clear the local session even when the server session is already invalid.
    } finally {
      storage?.clear();
      setUser(null);
    }
  };

  const handleAccountDeleted = async () => {
    getBrowserTokenStorage()?.clear();
    setUser(null);
    setMessage("账号已注销，相关个人数据已删除。");
  };

  if (user) {
    return <AuthenticatedHome user={user} onLogout={handleLogout} onAccountDeleted={handleAccountDeleted} />;
  }

  return (
    <AuthGate
      onAuthenticated={setUser}
      loading={<div aria-live="polite" role="status" />}
      authenticated={(restoredUser) => (
        <AuthenticatedHome
          user={restoredUser}
          onLogout={handleLogout}
          onAccountDeleted={handleAccountDeleted}
        />
      )}
      anonymous={(
        <main className="entry-shell">
          <section className="brand-panel">
            <div className="island-mark">心</div>
            <p className="eyebrow">XINYU · ISLAND</p>
            <h1>心屿</h1>
            <p className="brand-copy">一个可以聊天、探索和暂时停靠的想象空间。</p>
            <div className="notice-card">
              <span>✦</span>
              <p>心屿提供娱乐与陪伴体验。AI 的回答仅供娱乐参考，不构成医疗、法律、财务或其他专业建议。</p>
            </div>
          </section>
          <section className="auth-card">
            <div className="tabs">
              <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>登录</button>
              <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setMessage(""); }}>注册</button>
            </div>
            {mode === "login"
              ? <LoginForm onSuccess={setUser} onMessage={setMessage} />
              : <RegisterForm onSuccess={setUser} onMessage={setMessage} />}
            {message && <p className="form-message">{message}</p>}
          </section>
        </main>
      )}
    />
  );
}

function LoginForm({ onSuccess, onMessage }: {
  onSuccess: (user: AuthUser) => void;
  onMessage: (message: string) => void;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const session = await login({
        email: String(form.get("email")),
        password: String(form.get("password")),
        deviceLabel: "web"
      });
      getBrowserTokenStorage()?.write(session.accessToken);
      onSuccess(session.user);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "暂时无法登录");
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>邮箱<input name="email" type="email" placeholder="you@example.com" required /></label>
      <label>密码<input name="password" type="password" placeholder="至少 8 位" required /></label>
      <button className="primary-button" type="submit">进入心屿</button>
      <p className="helper">首次使用？切换到“注册”创建你的专属入口。</p>
    </form>
  );
}

function RegisterForm({ onSuccess, onMessage }: {
  onSuccess: (user: AuthUser) => void;
  onMessage: (message: string) => void;
}) {
  const [consents, setConsents] = useState<ConsentSelection>(EMPTY_CONSENT_SELECTION);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isConsentSelectionComplete(consents)) {
      onMessage("请先确认三项内部封闭测试版文档与娱乐使用提示");
      return;
    }

    const form = new FormData(event.currentTarget);
    try {
      const session = await register({
        email: String(form.get("email")),
        password: String(form.get("password")),
        nickname: String(form.get("nickname")),
        ageBand: String(form.get("ageBand")),
        deviceLabel: "web",
        consents: buildConsentPayload(consents)
      });
      getBrowserTokenStorage()?.write(session.accessToken);
      onSuccess(session.user);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "暂时无法注册");
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>昵称<input name="nickname" placeholder="给自己一个称呼" maxLength={40} required /></label>
      <label>邮箱<input name="email" type="email" placeholder="you@example.com" required /></label>
      <label>密码<input name="password" type="password" placeholder="至少 8 位" minLength={8} required /></label>
      <label>
        年龄段
        <select name="ageBand" defaultValue="undisclosed">
          <option value="under_13">13 岁以下</option>
          <option value="13_15">13–15 岁</option>
          <option value="16_17">16–17 岁</option>
          <option value="18_plus">18 岁以上</option>
          <option value="undisclosed">暂不透露</option>
        </select>
      </label>
      <ConsentChecklist value={consents} onChange={setConsents} />
      <button className="primary-button" type="submit" disabled={!isConsentSelectionComplete(consents)}>创建心屿账号</button>
    </form>
  );
}

function AuthenticatedHome({ user, onLogout, onAccountDeleted }: {
  user: AuthUser;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => Promise<void>;
}) {
  const [activeNav, setActiveNav] = useState<AppDestination>("chat");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [requestedConversationId, setRequestedConversationId] = useState("");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("free");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void listContacts()
      .then((loaded) => { if (active) setContacts(loaded); })
      .catch((error: unknown) => { if (active) setNotice(operationalNotice(error, "暂时无法加载联系人")); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void listConversations()
      .then((loaded) => { if (active) setHistory(loaded); })
      .catch((error: unknown) => { if (active) setNotice(operationalNotice(error, "暂时无法加载最近对话")); });
    return () => { active = false; };
  }, []);

  const refreshHistory = async () => {
    try {
      setHistory(await listConversations());
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法加载最近对话"));
    }
  };

  const refreshContacts = async () => {
    try {
      setContacts(await listContacts());
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法加载联系人"));
    }
  };

  const openContact = async (contact: Contact) => {
    setNotice("");
    const recent = history.find((conversation) => conversation.kind === "single" && conversation.contactId === contact.id);
    if (recent) {
      setRequestedConversationId(recent.id);
      setActiveNav("chat");
      return;
    }
    const created = await createConversation(contact.id);
    setRequestedConversationId(created.id);
    await refreshHistory();
    setActiveNav("chat");
  };

  const openGroup = async (group: CreateGroupResult) => {
    setRequestedConversationId(group.id);
    await refreshHistory();
    setActiveNav("chat");
  };

  const contentView = activeNav === "contacts"
    ? (
      <ContactsHome
        contacts={contacts}
        onOpenContact={openContact}
        onGroupCreated={(group) => { void openGroup(group); }}
        onContactsChange={refreshContacts}
      />
    )
    : activeNav === "apps"
      ? <AppsHome />
      : activeNav === "me"
        ? (
          <MeHome
            user={user}
            contacts={contacts}
            onLogout={onLogout}
            onAccountDeleted={onAccountDeleted}
          />
        )
        : (
          <ChatShell
            conversations={history}
            contacts={contacts}
            initialConversationId={requestedConversationId}
            initialNotice={notice}
            welcomeName={user.nickname}
            generationMode={generationMode}
            onGenerationModeChange={setGenerationMode}
            onConversationsChange={refreshHistory}
          />
        );

  const pageTitle = activeNav === "contacts"
    ? "联系人"
    : activeNav === "apps"
      ? "应用"
      : activeNav === "me"
        ? "我的"
        : "聊天";

  return (
    <main className="app-shell">
      <AppNavigation
        active={activeNav}
        onNavigate={setActiveNav}
        profile={user}
        onLogout={() => { void onLogout(); }}
      />
      <section className="app-main">
        <header className="app-header">
          <div><p className="eyebrow">{activeNav.toUpperCase()}</p><h2>{pageTitle}</h2></div>
        </header>
        {contentView}
      </section>
    </main>
  );
}
