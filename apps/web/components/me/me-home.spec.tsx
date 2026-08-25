// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../lib/auth-api";
import { MeHome } from "./me-home";

const user: AuthUser = {
  id: "user-1",
  nickname: "测试",
  email: "user@example.com",
  ageBand: "18_plus",
  status: "active",
  defaultMemoryEnabled: false,
  createdAt: "2026-08-18T00:00:00.000Z"
};

describe("MeHome", () => {
  afterEach(cleanup);

  it("groups account, memories, privacy, agreement and settings", async () => {
    render(
      <MeHome
        user={user}
        contacts={[]}
        onLogout={vi.fn().mockResolvedValue(undefined)}
        loadUsage={vi.fn().mockResolvedValue({
          free: { limit: 6000, used: 100, remaining: 5900, resetAt: "2026-08-19T00:00:00.000Z" },
          token: { paidBalance: 0 }
        })}
      />
    );

    expect(await screen.findByRole("heading", { name: "账号与用量" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "记忆管理" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "隐私与安全" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "用户协议" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "设置" })).toBeVisible();
    expect(screen.getByText("Token 模拟用量")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "新建单聊默认开启长期记忆" })).not.toBeChecked();
  });
});
