// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Contact, ContactMemory } from "../../lib/contacts-api";
import { MemoryManager } from "./memory-manager";

const contacts: Contact[] = [{
  id: "lan",
  name: "岚",
  tagline: "通用陪伴者",
  description: "",
  avatar: "岚",
  tone: "温和",
  type: "official",
  skills: [],
  editable: false,
  canDelete: false
}];

const memory: ContactMemory = {
  id: "memory-1",
  contactId: "lan",
  fact: "我喜欢在傍晚散步",
  sensitivity: "normal",
  source: "user_explicit",
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z"
};

describe("MemoryManager", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires confirmation before deleting a contact memory", async () => {
    const deleteMemory = vi.fn().mockResolvedValue({ success: true });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryManager
        contacts={contacts}
        loadMemories={vi.fn().mockResolvedValue([memory])}
        deleteMemory={deleteMemory}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "删除记忆：我喜欢在傍晚散步" }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(deleteMemory).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "删除记忆：我喜欢在傍晚散步" }));

    await waitFor(() => expect(deleteMemory).toHaveBeenCalledWith("memory-1"));
    expect(screen.queryByText("我喜欢在傍晚散步")).not.toBeInTheDocument();
  });
});
