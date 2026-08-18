// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillResultCard } from "./skill-result-card";

const ziweiCard = { skill: "ziwei" as const, title: "紫微斗数", summary: "围绕此刻主题的意象化解读", disclaimer: "趣味解读，仅供娱乐参考" as const, actions: ["return_to_chat" as const] };

describe("SkillResultCard", () => {
  it("renders the fixed entertainment label without raw birth input", () => {
    render(<SkillResultCard card={ziweiCard} onRemember={vi.fn()} />);
    expect(screen.getByText("趣味解读，仅供娱乐参考")).toBeVisible();
    expect(screen.queryByText("2001-01-01")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "记住此信息" })).toBeVisible();
  });
});
