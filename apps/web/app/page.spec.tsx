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
});
