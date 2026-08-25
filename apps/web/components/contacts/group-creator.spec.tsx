// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "../../lib/contacts-api";
import { GroupCreator } from "./group-creator";

const contacts: Contact[] = ["岚", "衡", "星", "舟"].map((name, index) => ({
  id: `contact-${index + 1}`,
  name,
  tagline: "",
  description: "",
  avatar: name,
  tone: "",
  type: "official" as const,
  skills: [],
  editable: false,
  canDelete: false
}));

describe("GroupCreator", () => {
  afterEach(cleanup);

  it("caps a discussion group at three AI contacts", () => {
    const onCreate = vi.fn();
    render(<GroupCreator contacts={contacts} onCreate={onCreate} />);

    for (const contact of contacts.slice(0, 3)) {
      fireEvent.click(screen.getByRole("checkbox", { name: contact.name }));
    }

    expect(screen.getByRole("checkbox", { name: "舟" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "创建讨论组" }));
    expect(onCreate).toHaveBeenCalledWith(["contact-1", "contact-2", "contact-3"]);
  });
});
