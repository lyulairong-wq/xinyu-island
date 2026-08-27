// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "../../app/page";
import { CONSENT_DOCUMENTS } from "@xinyu/contracts";
import {
  buildConsentPayload,
  ConsentChecklist,
  type ConsentSelection
} from "./consent-checklist";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function ChecklistHarness() {
  const [value, setValue] = useState<ConsentSelection>({
    terms: false,
    privacy: false,
    entertainment_notice: false
  });

  return <ConsentChecklist value={value} onChange={setValue} />;
}

describe("ConsentChecklist", () => {
  it("renders each required internal closed-beta document separately", () => {
    render(<ChecklistHarness />);

    expect(screen.getByRole("checkbox", { name: /用户协议.*内部封闭测试版 v1.0/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /隐私政策.*内部封闭测试版 v1.0/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /娱乐使用提示.*内部封闭测试版 v1.0/ })).toBeInTheDocument();
  });

  it("renders titles from the shared consent document catalog", () => {
    render(<ChecklistHarness />);

    for (const document of CONSENT_DOCUMENTS) {
      expect(screen.getByRole("button", { name: document.title })).toBeInTheDocument();
    }
  });

  it("opens readable consent content without navigating to a missing page anchor", () => {
    render(<ChecklistHarness />);

    fireEvent.click(screen.getByRole("button", { name: /用户协议.*内部封闭测试版 v1.0/ }));

    expect(screen.getByRole("dialog", { name: /用户协议/ })).toHaveTextContent("仅供娱乐参考");
    expect(window.location.hash).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "关闭协议内容" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps registration disabled until every required consent is selected", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: "注册" }));
    const submit = screen.getByRole("button", { name: "创建心屿账号" });
    expect(submit).toBeDisabled();

    for (const checkbox of screen.getAllByRole("checkbox")) {
      fireEvent.click(checkbox);
    }

    expect(submit).toBeEnabled();
  });

  it("builds the complete auditable payload in required-consent order", () => {
    expect(buildConsentPayload({ terms: true, privacy: true, entertainment_notice: true }))
      .toEqual(CONSENT_DOCUMENTS.map(({ type, version }) => ({ type, version })));
  });
});
