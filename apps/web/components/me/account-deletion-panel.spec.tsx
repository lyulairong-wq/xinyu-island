// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationalApiError } from "../../lib/api-client";
import { deleteAccount } from "../../lib/account-api";
import { AccountDeletionPanel } from "./account-deletion-panel";

vi.mock("../../lib/account-api", () => ({
  deleteAccount: vi.fn()
}));

describe("AccountDeletionPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires a password and irreversible acknowledgement before enabling deletion", () => {
    render(<AccountDeletionPanel onDeleted={vi.fn().mockResolvedValue(undefined)} />);

    const button = screen.getByRole("button", { name: "立即注销账号" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "password123" } });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText("我理解注销后无法恢复"));
    expect(button).toBeEnabled();
  });

  it("calls the completion callback only after the deletion API succeeds", async () => {
    let resolveDeletion!: (value: { success: true }) => void;
    vi.mocked(deleteAccount).mockImplementation(() => new Promise((resolve) => {
      resolveDeletion = resolve;
    }));
    const onDeleted = vi.fn().mockResolvedValue(undefined);
    render(<AccountDeletionPanel onDeleted={onDeleted} />);

    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByLabelText("我理解注销后无法恢复"));
    fireEvent.click(screen.getByRole("button", { name: "立即注销账号" }));

    expect(deleteAccount).toHaveBeenCalledWith({ password: "password123", confirmed: true });
    expect(onDeleted).not.toHaveBeenCalled();

    resolveDeletion({ success: true });

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it("keeps the destructive panel and session handoff untouched when deletion fails", async () => {
    vi.mocked(deleteAccount).mockRejectedValue(
      new OperationalApiError("提交的信息有误，请检查后重试", 400, "ACCOUNT_DELETION_INVALID")
    );
    const onDeleted = vi.fn().mockResolvedValue(undefined);
    render(<AccountDeletionPanel onDeleted={onDeleted} />);

    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByLabelText("我理解注销后无法恢复"));
    fireEvent.click(screen.getByRole("button", { name: "立即注销账号" }));

    expect(await screen.findByRole("status")).toHaveTextContent("提交的信息有误，请检查后重试");
    expect(screen.getByLabelText("当前密码")).toHaveValue("wrong-password");
    expect(screen.getByLabelText("我理解注销后无法恢复")).toBeChecked();
    expect(screen.getByRole("button", { name: "立即注销账号" })).toBeVisible();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
