// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationalApiError } from "../../lib/api-client";
import { getConsentDocuments } from "../../lib/account-api";
import { ConsentDocuments } from "./consent-documents";

vi.mock("../../lib/account-api", () => ({
  getConsentDocuments: vi.fn()
}));

const document = {
  type: "privacy" as const,
  title: "服务器返回的隐私政策",
  version: "1.0" as const,
  content: "这段只读正文来自服务器。",
  grantedAt: "2026-08-27T00:00:00.000Z"
};

describe("ConsentDocuments", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads once and renders server-returned agreement metadata with expandable read-only content", async () => {
    vi.mocked(getConsentDocuments).mockResolvedValue({ documents: [document] });

    render(<ConsentDocuments />);

    expect(screen.getByRole("status")).toHaveTextContent("正在加载协议");
    expect(await screen.findByRole("heading", { name: "协议和隐私" })).toBeVisible();
    expect(screen.getByText(document.title)).toBeVisible();
    expect(screen.getByText("版本 1.0")).toBeVisible();
    expect(screen.getByText("确认时间")).toBeVisible();
    expect(screen.getByText(new Date(document.grantedAt).toLocaleString("zh-CN"))).toBeVisible();
    expect(screen.queryByText(document.content)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `查看${document.title}` }));

    expect(screen.getByText(document.content)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(getConsentDocuments).toHaveBeenCalledOnce();
  });

  it("uses the operational notice for a load failure", async () => {
    vi.mocked(getConsentDocuments).mockRejectedValue(
      new OperationalApiError("登录状态已失效，请重新登录", 401)
    );

    render(<ConsentDocuments />);

    expect(await screen.findByText("登录状态已失效，请重新登录", { selector: "[role='status']" })).toBeVisible();
  });

  it("shows a read-only empty state when the server returns no active documents", async () => {
    vi.mocked(getConsentDocuments).mockResolvedValue({ documents: [] });

    render(<ConsentDocuments />);

    expect(await screen.findByText("暂无可查看的协议。")).toBeVisible();
  });
});
