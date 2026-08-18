// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationSummary } from "../../lib/chat-api";
import { ConversationList } from "./conversation-list";

const conversations: ConversationSummary[] = [
  {
    id: "group-1",
    contactId: "contact-1",
    kind: "group",
    title: "周末讨论组",
    memoryEnabled: false,
    archivedAt: null,
    updatedAt: "2026-08-18T11:00:00.000Z",
    contact: { id: "contact-1", name: "岚", tagline: "", description: "", avatar: "岚", tone: "", type: "official", skills: [], editable: false, canDelete: false },
    preview: "一起想想"
  },
  {
    id: "single-1",
    contactId: "contact-2",
    kind: "single",
    title: null,
    memoryEnabled: false,
    archivedAt: null,
    updatedAt: "2026-08-18T10:00:00.000Z",
    contact: { id: "contact-2", name: "衡", tagline: "", description: "", avatar: "衡", tone: "", type: "official", skills: [], editable: false, canDelete: false },
    preview: "只搜索标题和联系人"
  }
];

describe("ConversationList", () => {
  afterEach(cleanup);

  it("searches contact, group and title fields without message full-text search", () => {
    render(<ConversationList conversations={conversations} onSelect={vi.fn()} onArchive={vi.fn()} onDelete={vi.fn()} onNewChat={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索对话" }), { target: { value: "讨论组" } });
    expect(screen.getByRole("button", { name: "周末讨论组" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "衡" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索对话" }), { target: { value: "只搜索标题和联系人" } });
    expect(screen.getByText("没有匹配的对话")).toBeVisible();
  });

  it("requires confirmation before deleting and exposes archive independently", () => {
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    render(<ConversationList conversations={conversations} onSelect={vi.fn()} onArchive={onArchive} onDelete={onDelete} onNewChat={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "归档 周末讨论组" }));
    expect(onArchive).toHaveBeenCalledWith(conversations[0]);

    fireEvent.click(screen.getByRole("button", { name: "删除 周末讨论组" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认删除 周末讨论组" }));
    expect(onDelete).toHaveBeenCalledWith(conversations[0]);
  });
});
