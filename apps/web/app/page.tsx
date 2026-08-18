"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { AppsHome } from "../components/apps/apps-home";
import { AuthGate } from "../components/auth/auth-gate";
import {
  buildConsentPayload,
  ConsentChecklist,
  EMPTY_CONSENT_SELECTION,
  isConsentSelectionComplete,
  type ConsentSelection
} from "../components/auth/consent-checklist";
import { MeHome } from "../components/me/me-home";
import { AppNavigation, type AppDestination } from "../components/navigation/app-navigation";
import { operationalNotice } from "../lib/api-client";
import { login, logout, register, type AuthUser } from "../lib/auth-api";
import { getBrowserTokenStorage } from "../lib/auth-session";
import {
  createConversation,
  createGroup,
  getConversation,
  listConversations,
  sendMessage,
  updateConversation,
  type ConversationSummary,
  type GenerationMode,
  type Message
} from "../lib/chat-api";
import { deleteContact, listContacts, type Contact } from "../lib/contacts-api";

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

  if (user) return <AuthenticatedHome user={user} onLogout={handleLogout} />;

  return (
    <AuthGate
      onAuthenticated={setUser}
      loading={<div aria-live="polite" role="status" />}
      authenticated={(restoredUser) => <AuthenticatedHome user={restoredUser} onLogout={handleLogout} />}
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

function AuthenticatedHome({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const [activeNav, setActiveNav] = useState<AppDestination>("chat");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
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
    setSelected(contact);
    setMessages([]);
    setNotice("");
    try {
      const conversation = await createConversation(contact.id);
      setConversationId(conversation.id);
      setMemoryEnabled(conversation.memoryEnabled);
      await refreshHistory();
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法创建对话"));
    }
  };

  const openHistory = async (item: ConversationSummary) => {
    try {
      const conversation = await getConversation(item.id);
      setConversationId(item.id);
      setSelected(conversation.contact);
      setMessages(conversation.messages);
      setMemoryEnabled(conversation.memoryEnabled);
      setActiveNav("chat");
      setNotice("");
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法打开对话"));
    }
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || !conversationId) return;

    const outgoing = content;
    setContent("");
    try {
      const result = await sendMessage(conversationId, {
        content: outgoing,
        mode: generationMode,
        memoryEnabled: false
      });
      const replies = result.assistantMessages ?? (result.assistantMessage ? [result.assistantMessage] : []);
      setMessages((current) => [...current, result.userMessage, ...replies]);
      setNotice(result.notice);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法发送消息"));
    }
  };

  const toggleConversationMemory = async () => {
    if (!conversationId) return;
    const next = !memoryEnabled;
    try {
      await updateConversation(conversationId, { memoryEnabled: next });
      setMemoryEnabled(next);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法更新记忆设置"));
    }
  };

  const openGroup = (id: string, members: Contact[]) => {
    setConversationId(id);
    setSelected({
      id,
      name: "多人讨论组",
      tagline: `${members.map((member) => member.name).join("、")} · 顺序回复`,
      description: "AI 联系人将按设定顺序参与讨论。",
      avatar: "组",
      tone: "",
      type: "private",
      skills: [],
      editable: false,
      canDelete: false
    });
    setMessages([]);
    setMemoryEnabled(false);
    setActiveNav("chat");
  };

  const contentView = activeNav === "contacts"
    ? <ContactsPanel contacts={contacts} onRefresh={refreshContacts} onGroupCreated={openGroup} />
    : activeNav === "apps"
      ? <AppsHome />
      : activeNav === "me"
        ? <MeHome user={user} contacts={contacts} onLogout={onLogout} />
        : selected
          ? (
            <div className="conversation">
              <div className="contact-intro">
                <span className="contact-avatar">{selected.avatar}</span>
                <div><b>{selected.name}</b><p>{selected.tagline} · {selected.description}</p></div>
                <button
                  className={`memory-toggle ${memoryEnabled ? "on" : ""}`}
                  type="button"
                  onClick={() => void toggleConversationMemory()}
                >{memoryEnabled ? "记忆已开" : "记忆已关"}</button>
              </div>
              <div className="message-list">
                {messages.length === 0 && <p className="conversation-empty">从一句简单的问候开始吧。</p>}
                {messages.map((item) => <div className={`bubble ${item.role}`} key={item.id}>{item.content}</div>)}
              </div>
              {notice && <p className="chat-notice" role="status">{notice}</p>}
              <form className="composer" onSubmit={send}>
                <input
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={`和 ${selected.name} 说点什么…`}
                  maxLength={4000}
                />
                <button type="submit">发送</button>
              </form>
            </div>
          )
          : (
            <div className="welcome">
              <div className="welcome-orb">✦</div>
              <h3>欢迎来到心屿，{user.nickname}</h3>
              <p>选择一个 AI 联系人，开始一段轻松的对话。</p>
              {notice && <p className="chat-notice" role="status">{notice}</p>}
              {history.length > 0 && (
                <div className="history-list">
                  <p className="section-label">最近对话</p>
                  {history.slice(0, 6).map((item) => (
                    <button className="history-row" type="button" onClick={() => void openHistory(item)} key={item.id}>
                      <span className="contact-avatar">{item.contact.avatar}</span>
                      <span><b>{item.contact.name}{item.kind === "group" ? " · 讨论组" : ""}</b><small>{item.preview}</small></span>
                      <time>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</time>
                    </button>
                  ))}
                </div>
              )}
              <div className="contact-grid">
                {contacts.map((contact) => (
                  <button className="contact-card" type="button" onClick={() => void openContact(contact)} key={contact.id}>
                    <span className="contact-avatar">{contact.avatar}</span>
                    <span><b>{contact.name}</b><small>{contact.tagline}</small></span>
                  </button>
                ))}
              </div>
            </div>
          );

  const pageTitle = activeNav === "chat"
    ? selected?.name ?? "聊天"
    : activeNav === "contacts"
      ? "联系人"
      : activeNav === "apps"
        ? "应用"
        : "我的";

  return (
    <main className="chat-shell">
      <AppNavigation
        active={activeNav}
        onNavigate={setActiveNav}
        profile={user}
        onLogout={() => { void onLogout(); }}
      />
      <section className="chat-main">
        <header>
          <div><p className="eyebrow">{activeNav.toUpperCase()}</p><h2>{pageTitle}</h2></div>
          {activeNav === "chat" && (
            <div className="mode-switch">
              <button className={generationMode === "free" ? "active" : ""} type="button" onClick={() => setGenerationMode("free")}>免费</button>
              <button className={generationMode === "token" ? "active" : ""} type="button" onClick={() => setGenerationMode("token")}>Token</button>
            </div>
          )}
        </header>
        {contentView}
      </section>
    </main>
  );
}

function ContactsPanel({ contacts, onRefresh, onGroupCreated }: {
  contacts: Contact[];
  onRefresh: () => Promise<void>;
  onGroupCreated: (id: string, members: Contact[]) => void;
}) {
  const [grouping, setGrouping] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const remove = async (id: string) => {
    try {
      await deleteContact(id);
      await onRefresh();
    } catch (error) {
      setMessage(operationalNotice(error, "暂时无法删除联系人"));
    }
  };

  const submitGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIds.length < 2) {
      setMessage("至少选择两位 AI 联系人");
      return;
    }
    try {
      const group = await createGroup(selectedIds);
      onGroupCreated(group.id, contacts.filter((contact) => selectedIds.includes(contact.id)));
    } catch (error) {
      setMessage(operationalNotice(error, "暂时无法创建讨论组"));
    }
  };

  return (
    <div className="module-page">
      <div className="module-toolbar">
        <p>官方 AI 与我的 AI 联系人将在这里分组管理。</p>
        <button className="quiet-button" type="button" onClick={() => { setGrouping(!grouping); setMessage(""); }}>＋ 创建讨论组</button>
      </div>
      {message && <p className="form-message">{message}</p>}
      {grouping && (
        <form className="group-picker" onSubmit={submitGroup}>
          <p>选择 AI 联系人，回复将按选择顺序进行。</p>
          <div>
            {contacts.map((contact) => (
              <label key={contact.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(contact.id)}
                  onChange={(event) => setSelectedIds(event.target.checked
                    ? [...selectedIds, contact.id]
                    : selectedIds.filter((id) => id !== contact.id))}
                />
                {contact.name}
              </label>
            ))}
          </div>
          <button className="primary-button" type="submit">开始讨论</button>
        </form>
      )}
      <div className="contact-list">
        {contacts.map((contact) => (
          <div className="contact-row" key={contact.id}>
            <span className="contact-avatar">{contact.avatar}</span>
            <div className="contact-row-copy">
              <b>{contact.name}</b>
              <small>{contact.tagline} · {contact.type === "private" ? "私有联系人" : "官方联系人"}</small>
              <p>{contact.description}</p>
            </div>
            {contact.canDelete && <button className="text-button" type="button" onClick={() => void remove(contact.id)}>删除</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
