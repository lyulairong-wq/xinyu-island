// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationDetail, ConversationSummary, SendMessageResult } from "../../lib/chat-api";
import type { Contact } from "../../lib/contacts-api";
import type { SkillSessionResult } from "../../lib/skills-api";
import { ChatShell } from "./chat-shell";

const contacts: Contact[] = [
  {
    id: "contact-1",
    name: "岚",
    tagline: "陪伴者",
    description: "温和地聊聊天",
    avatar: "岚",
    tone: "温和",
    type: "official",
    skills: [],
    editable: false,
    canDelete: false
  },
  {
    id: "contact-2",
    name: "衡",
    tagline: "探索伙伴",
    description: "一起梳理想法",
    avatar: "衡",
    tone: "清晰",
    type: "official",
    skills: ["mbti"],
    primarySkill: "mbti",
    editable: false,
    canDelete: false
  },
  {
    id: "contact-3",
    name: "绘",
    tagline: "叙事解读者",
    description: "用画面感聊聊",
    avatar: "绘",
    tone: "感性",
    type: "official",
    skills: ["tarot"],
    primarySkill: "tarot",
    editable: false,
    canDelete: false
  }
];

const conversations: ConversationSummary[] = [
  {
    id: "conversation-1",
    contactId: contacts[0]!.id,
    kind: "single",
    title: "第一个对话",
    memoryEnabled: false,
    archivedAt: null,
    updatedAt: "2026-08-18T10:00:00.000Z",
    contact: contacts[0]!,
    preview: "你好"
  },
  {
    id: "conversation-2",
    contactId: contacts[1]!.id,
    kind: "single",
    title: "另一个对话",
    memoryEnabled: false,
    archivedAt: null,
    updatedAt: "2026-08-18T09:00:00.000Z",
    contact: contacts[1]!,
    preview: "最近怎么样"
  }
];

function detailFor(summary: ConversationSummary): ConversationDetail {
  return { ...summary, messages: [], members: [] };
}

describe("ChatShell", () => {
  afterEach(cleanup);

  it("preserves a local draft when switching conversations", async () => {
    render(
      <ChatShell
        conversations={conversations}
        contacts={contacts}
        initialConversationId="conversation-1"
        loadConversation={async (id) => detailFor(conversations.find((item) => item.id === id)!)}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "消息" }), { target: { value: "未发送草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "另一个对话" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue(""));
    fireEvent.change(screen.getByRole("textbox", { name: "消息" }), { target: { value: "第二份草稿" } });

    fireEvent.click(screen.getByRole("button", { name: "第一个对话" }));

    expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("未发送草稿");
  });

  it("clears a sent draft and keeps the operational notice outside message history", async () => {
    let resolveSend!: (result: SendMessageResult) => void;
    const send = vi.fn(() => new Promise<SendMessageResult>((resolve) => { resolveSend = resolve; }));
    render(
      <ChatShell
        conversations={conversations}
        contacts={contacts}
        initialConversationId="conversation-1"
        loadConversation={async () => detailFor(conversations[0]!)}
        send={send}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "消息" }), { target: { value: "想聊聊今天" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("岚正在输入");
    expect(screen.queryByRole("button", { name: /停止|取消生成/ })).not.toBeInTheDocument();

    resolveSend({
      userMessage: {
        id: "message-user",
        role: "user",
        content: "想聊聊今天",
        mode: "free",
        createdAt: "2026-08-18T10:01:00.000Z"
      },
      assistantMessage: {
        id: "message-assistant",
        role: "assistant",
        content: "我在听。",
        mode: "free",
        createdAt: "2026-08-18T10:01:01.000Z"
      },
      mode: "free",
      chargedTokens: 0,
      notice: "当前使用免费开源模型回复，仅供娱乐参考。"
    });

    await screen.findByText("我在听。");
    const history = screen.getByRole("list", { name: "消息记录" });
    expect(screen.getByRole("status")).toHaveTextContent("当前使用免费开源模型回复");
    expect(history).not.toHaveTextContent("当前使用免费开源模型回复");
  });

  it("appends a regenerated reply without replacing the prior history", async () => {
    const existing = detailFor(conversations[0]!);
    existing.messages = [
      { id: "old-user", role: "user", content: "原问题", mode: "free", createdAt: "2026-08-18T10:00:00.000Z" },
      { id: "old-assistant", role: "assistant", content: "原回复", mode: "free", createdAt: "2026-08-18T10:00:01.000Z" }
    ];
    const send = vi.fn().mockResolvedValue({
      userMessage: { id: "new-user", role: "user", content: "原问题", mode: "free", createdAt: "2026-08-18T10:01:00.000Z" },
      assistantMessage: { id: "new-assistant", role: "assistant", content: "重新生成的回复", mode: "free", createdAt: "2026-08-18T10:01:01.000Z" },
      mode: "free",
      chargedTokens: 0,
      notice: "已重新生成"
    } satisfies SendMessageResult);
    render(
      <ChatShell
        conversations={conversations}
        contacts={contacts}
        initialConversationId="conversation-1"
        loadConversation={async () => existing}
        send={send}
      />
    );

    await screen.findByText("原回复");
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));

    await screen.findByText("重新生成的回复");
    expect(screen.getByText("原回复")).toBeVisible();
    expect(send).toHaveBeenCalledWith("conversation-1", { content: "原问题", mode: "free" });
  });

  it("starts a group skill with the selected eligible member as its target", async () => {
    const group: ConversationSummary = {
      id: "group-1",
      contactId: contacts[1]!.id,
      kind: "group",
      title: "讨论组",
      memoryEnabled: false,
      archivedAt: null,
      updatedAt: "2026-08-18T10:00:00.000Z",
      contact: contacts[1]!,
      preview: ""
    };
    const startSkill = vi.fn().mockResolvedValue({
      state: "fallback",
      fallback: "ordinary_chat",
      missingInputs: [],
      mode: "free",
      chargedTokens: 0
    } satisfies SkillSessionResult);
    render(
      <ChatShell
        conversations={[group]}
        contacts={contacts}
        initialConversationId="group-1"
        loadConversation={async () => ({ ...group, messages: [], members: [
          { id: "member-2", contactId: "contact-2", sortOrder: 0 },
          { id: "member-3", contactId: "contact-3", sortOrder: 1 }
        ] })}
        startSkill={startSkill}
      />
    );

    await screen.findByRole("textbox", { name: "消息" });
    fireEvent.click(screen.getByRole("button", { name: "更多功能" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "衡 · MBTI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "你的选择" }), { target: { value: "独处，计划" } });
    fireEvent.click(screen.getByRole("button", { name: "开始解读" }));

    await waitFor(() => expect(startSkill).toHaveBeenCalledWith("group-1", expect.objectContaining({
      skill: "mbti",
      targetContactId: "contact-2",
      answers: ["独处", "计划"],
      mode: "free"
    })));
  });
});
