// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppsHome } from "./apps-home";

describe("AppsHome", () => {
  afterEach(cleanup);

  it("shows only the two approved later-module launch cards", () => {
    render(<AppsHome />);

    expect(screen.getByRole("heading", { name: "人生镜像副本" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "主题活动" })).toBeVisible();
    expect(screen.getAllByText("后续模块开发")).toHaveLength(2);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("当前场景")).not.toBeInTheDocument();
  });
});
