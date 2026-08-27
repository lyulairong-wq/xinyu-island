// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "../lib/auth-session";

const restoredUser = {
  id: "user-1",
  email: "user@example.com",
  nickname: "测试",
  ageBand: "18_plus",
  status: "active",
  defaultMemoryEnabled: false,
  createdAt: "2026-08-09T00:00:00.000Z"
};

describe("HomePage logout", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("attempts server logout before clearing the local token when logout rejects", async () => {
    const events: string[] = [];
    const removeItem = window.localStorage.removeItem.bind(window.localStorage);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (key) {
      events.push(`clear:${key}`);
      removeItem(key);
    });
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");

    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/me")) {
        return Promise.resolve(new Response(JSON.stringify(restoredUser), { status: 200 }));
      }
      if (url.endsWith("/auth/logout")) {
        events.push("server-logout");
        return Promise.reject(new Error("network unavailable"));
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }));
    const { default: HomePage } = await import("./page");

    render(<HomePage />);

    fireEvent.click(await screen.findByRole("button", { name: /测试/ }));

    await waitFor(() => {
      expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    });
    await screen.findByRole("button", { name: "进入心屿" });
    expect(events).toEqual(["server-logout", `clear:${ACCESS_TOKEN_KEY}`]);
  });

  it("clears the deleted session without logout and shows one short anonymous success notice", async () => {
    const events: string[] = [];
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (key) {
      events.push(`clear:${key}`);
      throw new Error("storage is unavailable");
    });
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/me") && !url.endsWith("/me/consents")) {
        return Promise.resolve(new Response(JSON.stringify(restoredUser), { status: 200 }));
      }
      if (url.endsWith("/contacts") || url.endsWith("/conversations")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (url.endsWith("/usage")) {
        return Promise.resolve(new Response(JSON.stringify({
          free: { limit: 6000, used: 100, remaining: 5900, resetAt: "2026-08-28T00:00:00.000Z" },
          token: { paidBalance: 0 }
        }), { status: 200 }));
      }
      if (url.endsWith("/me/consents")) {
        return Promise.resolve(new Response(JSON.stringify({ documents: [] }), { status: 200 }));
      }
      if (url.endsWith("/me/account-deletion")) {
        events.push(`delete:${String(init?.body)}`);
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
      }
      if (url.endsWith("/auth/logout")) {
        events.push("server-logout");
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { default: HomePage } = await import("./page");

    render(<HomePage />);

    fireEvent.click(await screen.findByRole("button", { name: "我的" }));
    fireEvent.change(await screen.findByLabelText("当前密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByLabelText("我理解注销后无法恢复"));
    fireEvent.click(screen.getByRole("button", { name: "立即注销账号" }));

    await screen.findByRole("button", { name: "进入心屿" });
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-token");
    expect(screen.getAllByText("账号已注销，相关个人数据已删除。")).toHaveLength(1);
    expect(events).toEqual([
      'delete:{"password":"password123","confirmed":true}',
      `clear:${ACCESS_TOKEN_KEY}`
    ]);
  });

  it("keeps the authenticated account surface open when deletion fails", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/me") && !url.endsWith("/me/consents")) {
        return Promise.resolve(new Response(JSON.stringify(restoredUser), { status: 200 }));
      }
      if (url.endsWith("/contacts") || url.endsWith("/conversations")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (url.endsWith("/usage")) {
        return Promise.resolve(new Response(JSON.stringify({
          free: { limit: 6000, used: 100, remaining: 5900, resetAt: "2026-08-28T00:00:00.000Z" },
          token: { paidBalance: 0 }
        }), { status: 200 }));
      }
      if (url.endsWith("/me/consents")) {
        return Promise.resolve(new Response(JSON.stringify({ documents: [] }), { status: 200 }));
      }
      if (url.endsWith("/me/account-deletion")) {
        return Promise.resolve(new Response(JSON.stringify({ code: "ACCOUNT_DELETION_INVALID" }), { status: 400 }));
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
    const { default: HomePage } = await import("./page");

    render(<HomePage />);

    fireEvent.click(await screen.findByRole("button", { name: "我的" }));
    fireEvent.change(await screen.findByLabelText("当前密码"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByLabelText("我理解注销后无法恢复"));
    fireEvent.click(screen.getByRole("button", { name: "立即注销账号" }));

    expect(await screen.findByRole("status", { name: "" })).toHaveTextContent("提交的信息有误，请检查后重试");
    expect(screen.getByRole("heading", { name: "注销账号" })).toBeVisible();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-token");
    expect(screen.queryByText("账号已注销，相关个人数据已删除。")).not.toBeInTheDocument();
  });

  it("clears an account-deletion notice when a later login succeeds", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
    let deleted = false;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/me") && !url.endsWith("/me/consents")) {
        return Promise.resolve(new Response(JSON.stringify(restoredUser), { status: 200 }));
      }
      if (url.endsWith("/contacts") || url.endsWith("/conversations")) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      if (url.endsWith("/usage")) return Promise.resolve(new Response(JSON.stringify({ free: { limit: 6000, used: 0, remaining: 6000, resetAt: "2026-08-28T00:00:00.000Z" }, token: { paidBalance: 0 } }), { status: 200 }));
      if (url.endsWith("/me/consents")) return Promise.resolve(new Response(JSON.stringify({ documents: [] }), { status: 200 }));
      if (url.endsWith("/me/account-deletion")) { deleted = true; return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })); }
      if (url.endsWith("/auth/login")) return Promise.resolve(new Response(JSON.stringify({ accessToken: "new-token", sessionId: "new-session", user: restoredUser, requiredConsentTypes: [] }), { status: 200 }));
      if (url.endsWith("/auth/logout")) return Promise.resolve(new Response(null, { status: 204 }));
      throw new Error(`Unexpected request: ${url}`);
    }));
    const { default: HomePage } = await import("./page");
    render(<HomePage />);

    fireEvent.click(await screen.findByRole("button", { name: "我的" }));
    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "password123" } });
    fireEvent.click(document.querySelector('.confirmation-panel input[type="checkbox"]')!);
    fireEvent.click(document.querySelector(".danger-button")!);
    await screen.findByText(/账号已注销/);
    expect(deleted).toBe(true);

    fireEvent.change(document.querySelector('input[name="email"]')!, { target: { value: "new@example.com" } });
    fireEvent.change(document.querySelector('input[name="password"]')!, { target: { value: "password123" } });
    fireEvent.click(document.querySelector(".primary-button")!);
    await screen.findByRole("button", { name: "我的" });
    fireEvent.click(screen.getByRole("button", { name: /退出登录/ }));
    await waitFor(() => expect(document.querySelector(".auth-form")).toBeInTheDocument());
    expect(screen.queryByText(/账号已注销/)).not.toBeInTheDocument();
  });
});
