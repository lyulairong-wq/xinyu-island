// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type AuthUser } from "../../lib/auth-api";
import { AuthGate } from "./auth-gate";

const authenticatedUser: AuthUser = {
  id: "user-1",
  email: "user@example.com",
  nickname: "测试",
  ageBand: "18_plus",
  status: "active",
  createdAt: "2026-08-09T00:00:00.000Z"
};

function renderGate({
  token = "access-token",
  loadUser = async () => authenticatedUser
}: {
  token?: string | null;
  loadUser?: (token: string) => Promise<AuthUser>;
} = {}) {
  const clearAccessToken = vi.fn();

  render(
    <AuthGate
      storage={{ read: () => token, clear: clearAccessToken }}
      loadUser={loadUser}
      loading={<p>loading</p>}
      anonymous={<p>anonymous-child</p>}
      authenticated={(user) => <p>authenticated-child: {user.nickname}</p>}
    />
  );

  return { clearAccessToken };
}

describe("AuthGate", () => {
  it("keeps both entry branches hidden while a stored session is loading", () => {
    let resolveUser: ((user: AuthUser) => void) | undefined;
    const loadUser = () => new Promise<AuthUser>((resolve) => {
      resolveUser = resolve;
    });

    renderGate({ loadUser });

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByText(/authenticated-child/)).not.toBeInTheDocument();
    expect(screen.queryByText("anonymous-child")).not.toBeInTheDocument();

    resolveUser?.(authenticatedUser);
  });

  it("renders the authenticated branch when the stored session is valid", async () => {
    renderGate();

    expect(await screen.findByText("authenticated-child: 测试")).toBeInTheDocument();
  });

  it("renders the anonymous branch without loading a user when no token is stored", () => {
    const loadUser = vi.fn(async () => authenticatedUser);

    renderGate({ token: null, loadUser });

    expect(screen.getByText("anonymous-child")).toBeInTheDocument();
    expect(loadUser).not.toHaveBeenCalled();
  });

  it("clears an invalid stored token before rendering the anonymous branch", async () => {
    const { clearAccessToken } = renderGate({
      loadUser: async () => {
        throw new ApiError("登录状态已失效", 401);
      }
    });

    expect(await screen.findByText("anonymous-child")).toBeInTheDocument();
    expect(clearAccessToken).toHaveBeenCalledTimes(1);
  });
});
