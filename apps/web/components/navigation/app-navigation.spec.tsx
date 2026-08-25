// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNavigation } from "./app-navigation";

describe("AppNavigation", () => {
  afterEach(cleanup);

  it("uses chat as the authenticated default and exposes all four navigation destinations", () => {
    render(<AppNavigation onNavigate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "聊天" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "联系人" })).toBeVisible();
    expect(screen.getByRole("button", { name: "应用" })).toBeVisible();
    expect(screen.getByRole("button", { name: "我的" })).toBeVisible();
  });

  it("reports navigation changes and marks only the active destination", () => {
    const onNavigate = vi.fn();
    render(<AppNavigation active="apps" onNavigate={onNavigate} />);

    expect(screen.getByRole("button", { name: "应用" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "聊天" })).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("button", { name: "我的" }));
    expect(onNavigate).toHaveBeenCalledWith("me");
  });
});
