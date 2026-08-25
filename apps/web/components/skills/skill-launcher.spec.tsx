// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkillDefinition } from "../../lib/skills-api";
import { SkillLauncher } from "./skill-launcher";

const tarot: SkillDefinition = { code: "tarot", title: "塔罗", summary: "抽一张牌", disclaimer: "趣味解读，仅供娱乐参考", requiredInputs: ["topic"], noPrecisionRule: "不预测", cardActions: [] };
const mbti: SkillDefinition = { code: "mbti", title: "MBTI", summary: "做选择", disclaimer: "趣味解读，仅供娱乐参考", requiredInputs: ["answers"], noPrecisionRule: "不定论", cardActions: [] };

describe("SkillLauncher", () => {
  afterEach(cleanup);
  it("shows only the active contact's mounted skills in the composer menu", () => {
    render(<SkillLauncher skills={[tarot, mbti]} onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "更多功能" }));
    expect(screen.getByRole("menuitem", { name: "塔罗" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "紫微斗数" })).not.toBeInTheDocument();
  });

  it("shows the entertainment notice once and collects the required topic", () => {
    const onStart = vi.fn();
    render(<SkillLauncher skills={[tarot]} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "更多功能" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "塔罗" }));
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("趣味解读，仅供娱乐参考");
    expect(notice.closest("form")).toHaveClass("skill-input-flow");
    fireEvent.change(screen.getByRole("textbox", { name: "想聊的主题" }), { target: { value: "最近的感受" } });
    fireEvent.click(screen.getByRole("button", { name: "开始解读" }));
    expect(onStart).toHaveBeenCalledWith({ skill: "tarot", topic: "最近的感受" });
  });

  it("keeps the skill form separate from the chat composer form", () => {
    render(<SkillLauncher skills={[tarot]} onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "更多功能" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "塔罗" }));

    expect(screen.getByRole("form", { name: "塔罗最少信息" })).toBeVisible();
  });
});
