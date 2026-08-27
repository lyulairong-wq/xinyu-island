// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BetaFeedbackPanel } from "./beta-feedback-panel";

describe("BetaFeedbackPanel", () => {
  afterEach(cleanup);

  it("submits only a tester-selected category and explicit feedback text", async () => {
    const submit = vi.fn(async () => ({ id: "feedback-1", category: "experience" as const, createdAt: "2026-08-28T00:00:00.000Z" }));
    render(<BetaFeedbackPanel submit={submit} />);

    fireEvent.change(screen.getByLabelText("反馈内容"), { target: { value: "讨论组的两条回复之间希望有更清晰的间距。" } });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    expect(await screen.findByRole("status")).toHaveTextContent("已收到反馈");
    expect(submit).toHaveBeenCalledWith({ category: "experience", content: "讨论组的两条回复之间希望有更清晰的间距。" });
  });
});
