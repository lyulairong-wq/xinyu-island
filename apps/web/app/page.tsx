"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const consentItems = [
  ["terms", "用户协议"],
  ["privacy", "隐私政策"],
  ["entertainment_notice", "娱乐使用提示"]
] as const;

type User = { nickname: string; email: string; ageBand: string };
type Contact = { id: string; name: string; tagline: string; description: string; avatar: string; tone: string };
type Message = { id: string; role: "user" | "assistant"; content: string; mode?: "free" | "token"; createdAt: string };

export default function HomePage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");

  if (user) return <ChatHome user={user} onLogout={() => { localStorage.removeItem("xinyu_access_token"); setUser(null); }} />;

  return (
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
        {mode === "login" ? <LoginForm onSuccess={setUser} onMessage={setMessage} /> : <RegisterForm onSuccess={setUser} onMessage={setMessage} />}
        {message && <p className="form-message">{message}</p>}
      </section>
    </main>
  );
}

function LoginForm({ onSuccess, onMessage }: { onSuccess: (user: User) => void; onMessage: (message: string) => void }) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), deviceLabel: "web" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "登录失败，请稍后重试");
      localStorage.setItem("xinyu_access_token", data.accessToken);
      onSuccess(data.user);
    } catch (error) { onMessage(error instanceof Error ? error.message : "暂时无法登录"); }
  };
  return <form className="auth-form" onSubmit={submit}><label>邮箱<input name="email" type="email" placeholder="you@example.com" required /></label><label>密码<input name="password" type="password" placeholder="至少 8 位" required /></label><button className="primary-button" type="submit">进入心屿</button><p className="helper">首次使用？切换到“注册”创建你的专属入口。</p></form>;
}

function RegisterForm({ onSuccess, onMessage }: { onSuccess: (user: User) => void; onMessage: (message: string) => void }) {
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (consentItems.some(([key]) => !consents[key])) { onMessage("请先确认三项协议与娱乐使用提示"); return; }
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), nickname: form.get("nickname"), ageBand: form.get("ageBand"), deviceLabel: "web", consents: consentItems.map(([type]) => ({ type, version: "1.0" })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "注册失败，请稍后重试");
      localStorage.setItem("xinyu_access_token", data.accessToken);
      onSuccess(data.user);
    } catch (error) { onMessage(error instanceof Error ? error.message : "暂时无法注册"); }
  };
  return <form className="auth-form" onSubmit={submit}><label>昵称<input name="nickname" placeholder="给自己一个称呼" maxLength={40} required /></label><label>邮箱<input name="email" type="email" placeholder="you@example.com" required /></label><label>密码<input name="password" type="password" placeholder="至少 8 位" minLength={8} required /></label><label>年龄段<select name="ageBand" defaultValue="undisclosed"><option value="under_13">13 岁以下</option><option value="13_15">13–15 岁</option><option value="16_17">16–17 岁</option><option value="18_plus">18 岁以上</option><option value="undisclosed">暂不透露</option></select></label><div className="consent-list">{consentItems.map(([key, label]) => <label className="checkbox-row" key={key}><input type="checkbox" checked={Boolean(consents[key])} onChange={(event) => setConsents({ ...consents, [key]: event.target.checked })} />我已阅读并同意<span>{label}</span></label>)}</div><button className="primary-button" type="submit">创建心屿账号</button></form>;
}

function ChatHome({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"free" | "token">("free");
  const [notice, setNotice] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("xinyu_access_token") : null;

  useEffect(() => { void fetch(`${API_URL}/contacts/official`).then((response) => response.json()).then(setContacts).catch(() => setNotice("暂时无法加载官方 AI 联系人")); }, []);

  const openContact = async (contact: Contact) => {
    setSelected(contact); setMessages([]); setNotice("");
    try {
      const response = await fetch(`${API_URL}/chat/conversations`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ contactId: contact.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "无法创建对话");
      setConversationId(data.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "暂时无法创建对话"); }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!content.trim() || !conversationId) return;
    const outgoing = content; setContent("");
    try {
      const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ content: outgoing, mode, memoryEnabled: false }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "发送失败");
      setMessages((current) => [...current, data.userMessage, data.assistantMessage]); setNotice(data.notice);
    } catch (error) { setNotice(error instanceof Error ? error.message : "暂时无法发送消息"); }
  };

  return <main className="chat-shell"><aside className="sidebar"><div className="sidebar-brand"><span className="small-mark">心</span><span>心屿</span></div><nav><button className="nav-item selected">▣ <span>聊天</span></button><button className="nav-item">♧ <span>联系人</span></button><button className="nav-item">◇ <span>应用</span></button><button className="nav-item">◎ <span>我的</span></button></nav><button className="profile" onClick={onLogout}><span className="avatar">{user.nickname.slice(0, 1)}</span><span><b>{user.nickname}</b><small>退出登录</small></span></button></aside><section className="chat-main"><header><div><p className="eyebrow">CHAT</p><h2>{selected?.name ?? "聊天"}</h2></div><div className="mode-switch"><button className={mode === "free" ? "active" : ""} onClick={() => setMode("free")}>免费</button><button className={mode === "token" ? "active" : ""} onClick={() => setMode("token")}>Token</button></div></header>{selected ? <div className="conversation"><div className="contact-intro"><span className="contact-avatar">{selected.avatar}</span><div><b>{selected.name}</b><p>{selected.tagline} · {selected.description}</p></div></div><div className="message-list">{messages.length === 0 && <p className="conversation-empty">从一句简单的问候开始吧。</p>}{messages.map((message) => <div className={`bubble ${message.role}`} key={message.id}>{message.content}</div>)}</div>{notice && <p className="chat-notice">{notice}</p>}<form className="composer" onSubmit={send}><input value={content} onChange={(event) => setContent(event.target.value)} placeholder={`和 ${selected.name} 说点什么…`} maxLength={4000} /><button type="submit">发送</button></form></div> : <div className="welcome"><div className="welcome-orb">✦</div><h3>欢迎来到心屿，{user.nickname}</h3><p>选择一个 AI 联系人，开始一段轻松的对话。</p><div className="contact-grid">{contacts.map((contact) => <button className="contact-card" onClick={() => void openContact(contact)} key={contact.id}><span className="contact-avatar">{contact.avatar}</span><span><b>{contact.name}</b><small>{contact.tagline}</small></span></button>)}</div></div>}</section></main>;
}
