"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const consentItems = [
  ["terms", "用户协议"],
  ["privacy", "隐私政策"],
  ["entertainment_notice", "娱乐使用提示"]
] as const;

type User = { nickname: string; email: string; ageBand: string };
type Contact = { id: string; name: string; tagline: string; description: string; avatar: string; tone: string; type?: "official" | "private"; canDelete?: boolean };
type Message = { id: string; role: "user" | "assistant"; content: string; mode?: "free" | "token"; createdAt: string };
type Memory = { id: string; contactId: string; fact: string; sensitivity: "normal" | "sensitive" };

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
  const [activeNav, setActiveNav] = useState<"chat" | "contacts" | "apps" | "me">("chat");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"free" | "token">("free");
  const [notice, setNotice] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("xinyu_access_token") : null;

  useEffect(() => { void fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${token ?? ""}` } }).then((response) => response.json()).then(setContacts).catch(() => setNotice("暂时无法加载联系人")); }, [token]);

  const openContact = async (contact: Contact) => {
    setSelected(contact); setMessages([]); setNotice("");
    try {
      const response = await fetch(`${API_URL}/chat/conversations`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ contactId: contact.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "无法创建对话");
      setConversationId(data.id); setMemoryEnabled(Boolean(data.memoryEnabled));
    } catch (error) { setNotice(error instanceof Error ? error.message : "暂时无法创建对话"); }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!content.trim() || !conversationId) return;
    const outgoing = content; setContent("");
    try {
      const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ content: outgoing, mode, memoryEnabled: false }) });
      const data = await response.json(); if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : data.message?.message ?? "发送失败");
      setMessages((current) => [...current, data.userMessage, data.assistantMessage]); setNotice(data.notice);
    } catch (error) { setNotice(error instanceof Error ? error.message : "暂时无法发送消息"); }
  };
  const toggleConversationMemory = async () => { if (!conversationId) return; const next = !memoryEnabled; const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ memoryEnabled: next }) }); if (response.ok) setMemoryEnabled(next); };

  const refreshContacts = async () => { const response = await fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${token ?? ""}` } }); if (response.ok) setContacts(await response.json() as Contact[]); };
  const contentView = activeNav === "contacts" ? <ContactsPanel contacts={contacts} token={token} onRefresh={refreshContacts} /> : activeNav === "me" ? <MemoryPanel contacts={contacts} token={token} /> : activeNav === "apps" ? <LifeMirrorPanel /> : selected ? <div className="conversation"><div className="contact-intro"><span className="contact-avatar">{selected.avatar}</span><div><b>{selected.name}</b><p>{selected.tagline} · {selected.description}</p></div><button className={`memory-toggle ${memoryEnabled ? "on" : ""}`} onClick={() => void toggleConversationMemory()}>{memoryEnabled ? "记忆已开" : "记忆已关"}</button></div><div className="message-list">{messages.length === 0 && <p className="conversation-empty">从一句简单的问候开始吧。</p>}{messages.map((message) => <div className={`bubble ${message.role}`} key={message.id}>{message.content}</div>)}</div>{notice && <p className="chat-notice">{notice}</p>}<form className="composer" onSubmit={send}><input value={content} onChange={(event) => setContent(event.target.value)} placeholder={`和 ${selected.name} 说点什么…`} maxLength={4000} /><button type="submit">发送</button></form></div> : <div className="welcome"><div className="welcome-orb">✦</div><h3>欢迎来到心屿，{user.nickname}</h3><p>选择一个 AI 联系人，开始一段轻松的对话。</p><div className="contact-grid">{contacts.map((contact) => <button className="contact-card" onClick={() => void openContact(contact)} key={contact.id}><span className="contact-avatar">{contact.avatar}</span><span><b>{contact.name}</b><small>{contact.tagline}</small></span></button>)}</div></div>;
  return <main className="chat-shell"><aside className="sidebar"><div className="sidebar-brand"><span className="small-mark">心</span><span>心屿</span></div><nav><button className={`nav-item ${activeNav === "chat" ? "selected" : ""}`} onClick={() => setActiveNav("chat")}>▣ <span>聊天</span></button><button className={`nav-item ${activeNav === "contacts" ? "selected" : ""}`} onClick={() => setActiveNav("contacts")}>♧ <span>联系人</span></button><button className={`nav-item ${activeNav === "apps" ? "selected" : ""}`} onClick={() => setActiveNav("apps")}>◇ <span>应用</span></button><button className={`nav-item ${activeNav === "me" ? "selected" : ""}`} onClick={() => setActiveNav("me")}>◎ <span>我的</span></button></nav><button className="profile" onClick={onLogout}><span className="avatar">{user.nickname.slice(0, 1)}</span><span><b>{user.nickname}</b><small>退出登录</small></span></button></aside><section className="chat-main"><header><div><p className="eyebrow">{activeNav.toUpperCase()}</p><h2>{activeNav === "chat" ? selected?.name ?? "聊天" : activeNav === "contacts" ? "联系人" : activeNav === "apps" ? "应用" : "我的"}</h2></div>{activeNav === "chat" && <div className="mode-switch"><button className={mode === "free" ? "active" : ""} onClick={() => setMode("free")}>免费</button><button className={mode === "token" ? "active" : ""} onClick={() => setMode("token")}>Token</button></div>}</header>{contentView}</section></main>;
}

function ContactsPanel({ contacts, token, onRefresh }: { contacts: Contact[]; token: string | null; onRefresh: () => Promise<void> }) {
  const [creating, setCreating] = useState(false); const [message, setMessage] = useState("");
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch(`${API_URL}/contacts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ name: form.get("name"), tagline: form.get("tagline"), description: form.get("description"), tone: form.get("tone") }) }); if (response.ok) { setCreating(false); await onRefresh(); } else setMessage("创建失败，请稍后重试"); };
  const remove = async (id: string) => { await fetch(`${API_URL}/contacts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` } }); await onRefresh(); };
  return <div className="module-page"><div className="module-toolbar"><p>官方 AI 已默认存在，也可以创建只属于你的私有联系人。</p><button className="quiet-button" onClick={() => setCreating(!creating)}>＋ 创建联系人</button></div>{message && <p className="form-message">{message}</p>}{creating && <form className="inline-form" onSubmit={create}><input name="name" placeholder="联系人名称" required /><input name="tagline" placeholder="一句话介绍" /><input name="tone" placeholder="互动风格，如：温和、好奇" /><input name="description" placeholder="角色简介" /><button className="primary-button" type="submit">保存</button></form>}<div className="contact-list">{contacts.map((contact) => <div className="contact-row" key={contact.id}><span className="contact-avatar">{contact.avatar}</span><div className="contact-row-copy"><b>{contact.name}</b><small>{contact.tagline} · {contact.type === "private" ? "私有联系人" : "官方联系人"}</small><p>{contact.description}</p></div>{contact.canDelete && <button className="text-button" onClick={() => void remove(contact.id)}>删除</button>}</div>)}</div></div>;
}

function MemoryPanel({ contacts, token }: { contacts: Contact[]; token: string | null }) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? ""); const [memories, setMemories] = useState<Memory[]>([]); const [enabled, setEnabled] = useState(false); const [fact, setFact] = useState(""); const [usage, setUsage] = useState<{ free: { limit: number; used: number; remaining: number; resetAt: string }; token: { paidBalance: number } } | null>(null);
  useEffect(() => { if (!contactId) return; void fetch(`${API_URL}/contacts/${contactId}/memories`, { headers: { Authorization: `Bearer ${token ?? ""}` } }).then((response) => response.json()).then(setMemories); }, [contactId, token]);
  useEffect(() => { void fetch(`${API_URL}/usage`, { headers: { Authorization: `Bearer ${token ?? ""}` } }).then((response) => response.json()).then(setUsage); }, [token]);
  const toggle = async () => { const next = !enabled; setEnabled(next); await fetch(`${API_URL}/contacts/settings/memory-default`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ enabled: next }) }); };
  const add = async (event: FormEvent) => { event.preventDefault(); if (!fact.trim() || !contactId) return; const response = await fetch(`${API_URL}/contacts/${contactId}/memories`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ fact, sensitivity: "normal" }) }); if (response.ok) { setMemories([...memories, await response.json() as Memory]); setFact(""); } };
  return <div className="module-page">{usage && <div className="usage-card"><div><b>免费模式额度</b><p>用于限制开发者侧免费模型资源，不扣除你的 Token。</p></div><strong>{usage.free.remaining.toLocaleString()} <small>/ {usage.free.limit.toLocaleString()}</small></strong><span>重置于 {new Date(usage.free.resetAt).toLocaleDateString("zh-CN")}</span></div>}<div className="settings-card"><div><b>默认开启长期记忆</b><p>仅用于对应 AI 联系人，不同联系人之间不会共享。</p></div><button className={`toggle ${enabled ? "on" : ""}`} onClick={() => void toggle()}>{enabled ? "已开启" : "已关闭"}</button></div><label className="select-label">查看联系人记忆<select value={contactId} onChange={(event) => setContactId(event.target.value)}>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label><form className="memory-form" onSubmit={add}><input value={fact} onChange={(event) => setFact(event.target.value)} placeholder="添加一条明确的长期记忆" maxLength={300} /><button className="primary-button" type="submit">保存</button></form><div className="memory-list">{memories.map((memory) => <div className="memory-row" key={memory.id}><span>◌</span><p>{memory.fact}</p><small>{memory.sensitivity === "sensitive" ? "敏感" : "普通"}</small></div>)}{memories.length === 0 && <p className="conversation-empty">这个联系人还没有已保存的记忆。</p>}</div></div>;
}

const mirrorScenarios = [
  { id: "new-city", title: "去一座陌生的城市", intro: "你收到一封来自海边城市的邀请。这里没有熟悉的人，但有一间临海的小屋。", choices: [{ label: "带上行李，先去看看", result: "你在傍晚抵达海边，第一晚听着潮声入睡。新的故事从一个不确定的决定开始。" }, { label: "先留在熟悉的地方", result: "你给自己留出了一段缓冲时间，意外发现身边也有一条尚未走过的小路。" }] },
  { id: "old-letter", title: "一封迟到的信", intro: "整理旧物时，你发现一封没有寄出的信。信上只有一句：‘如果还有机会，你会怎么选？’", choices: [{ label: "写下现在的回答", result: "你没有寄出这封信，却终于把当时没有说完的话写完整了。" }, { label: "把信放回原处", result: "有些故事不需要立刻打开。你把信收好，给未来留下一个温柔的入口。" }] },
  { id: "small-stage", title: "登上一方小舞台", intro: "社区临时缺少一个分享者。你可以用十分钟，讲一件自己真正喜欢的小事。", choices: [{ label: "报名试试", result: "灯光亮起时，你先听见自己的呼吸，然后听见台下有人笑着回应。" }, { label: "坐在台下旁听", result: "你记录下几句喜欢的话，也在心里悄悄排练了属于自己的十分钟。" }] }
];

function LifeMirrorPanel() {
  const [scenarioId, setScenarioId] = useState(mirrorScenarios[0].id); const [choice, setChoice] = useState(""); const scenario = mirrorScenarios.find((item) => item.id === scenarioId) ?? mirrorScenarios[0];
  return <div className="mirror-page"><div className="mirror-heading"><div><p className="eyebrow">LIFE MIRROR</p><h3>人生镜像副本</h3><p>体验不同人生设定下的虚构分支与可能发展。</p></div><span className="mirror-disclaimer">仅供娱乐体验<br />不代表现实预测或行动建议</span></div><div className="mirror-scenarios">{mirrorScenarios.map((item) => <button className={item.id === scenario.id ? "selected" : ""} onClick={() => { setScenarioId(item.id); setChoice(""); }} key={item.id}>{item.title}</button>)}</div><div className="mirror-card"><span className="mirror-orb">◇</span><p className="mirror-label">当前场景</p><h4>{scenario.title}</h4><p className="mirror-intro">{scenario.intro}</p>{choice ? <div className="mirror-result"><small>这条分支继续展开</small><p>{choice}</p><button onClick={() => setChoice("")}>重新选择</button></div> : <div className="mirror-choices">{scenario.choices.map((item) => <button onClick={() => setChoice(item.result)} key={item.label}>{item.label}<span>→</span></button>)}</div>}</div></div>;
}
