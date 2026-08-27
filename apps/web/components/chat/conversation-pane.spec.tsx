// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../../lib/chat-api";
import type { Contact } from "../../lib/contacts-api";
import { ConversationPane } from "./conversation-pane";

const members: Contact[] = [
  { id: "lan", name: "岚", tagline: "", description: "", avatar: "岚", tone: "", type: "official", skills: [], editable: false, canDelete: false },
  { id: "heng", name: "衡", tagline: "", description: "", avatar: "衡", tone: "", type: "official", skills: [], editable: false, canDelete: false }
];

const messages: Message[] = [
  { id: "u1", role: "user", content: "你们怎么看？", mode: "free", createdAt: "2026-08-18T10:00:00.000Z" },
  { id: "a1", role: "assistant", content: "先听听自己。", mode: "free", createdAt: "2026-08-18T10:00:01.000Z" },
  { id: "a2", role: "assistant", content: "也可以列出线索。", mode: "free", createdAt: "2026-08-18T10:00:02.000Z" }
];

describe("ConversationPane", () => {
  afterEach(cleanup);

  it("renders group replies independently in member order", () => {
    render(
      <ConversationPane
        title="两人讨论组"
        kind="group"
        contact={members[0]!}
        members={members}
        messages={messages}
        draft=""
        mode="free"
        memoryEnabled={false}
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onModeChange={vi.fn()}
        onQuote={vi.fn()}
        onRegenerate={vi.fn()}
        onContinue={vi.fn()}
        onToggleMemory={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const history = screen.getByRole("list", { name: "消息记录" });
    const replies = within(history).getAllByRole("article").slice(1);
    expect(replies).toHaveLength(2);
    expect(replies[0]).toHaveTextContent("岚");
    expect(replies[0]).toHaveTextContent("先听听自己。");
    expect(replies[1]).toHaveTextContent("衡");
    expect(replies[1]).toHaveTextContent("也可以列出线索。");
  });

  it("limits message actions by role", () => {
    render(
      <ConversationPane
        title="两人讨论组"
        kind="group"
        contact={members[0]!}
        members={members}
        messages={messages}
        draft=""
        mode="free"
        memoryEnabled={false}
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onModeChange={vi.fn()}
        onQuote={vi.fn()}
        onRegenerate={vi.fn()}
        onContinue={vi.fn()}
        onToggleMemory={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const bubbles = screen.getAllByRole("article");
    expect(within(bubbles[0]!).getAllByRole("button").map((button) => button.textContent)).toEqual(["复制", "引用"]);
    expect(within(bubbles[1]!).getAllByRole("button").map((button) => button.textContent)).toEqual(["复制", "引用", "重新生成", "以此继续聊"]);
  });

  it("does not expose the token mode switch in closed beta", () => {
    render(
      <ConversationPane
        title="岚"
        kind="single"
        contact={members[0]!}
        members={[members[0]!]}
        messages={[]}
        draft=""
        mode="free"
        memoryEnabled={false}
        tokenModeEnabled={false}
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onModeChange={vi.fn()}
        onQuote={vi.fn()}
        onRegenerate={vi.fn()}
        onContinue={vi.fn()}
        onToggleMemory={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "免费" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Token" })).not.toBeInTheDocument();
  });
});
