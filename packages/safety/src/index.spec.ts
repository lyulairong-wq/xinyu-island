import { describe, expect, it } from "vitest";
import { evaluateMessage } from "./index";

describe("safety policy", () => {
  it("allows ordinary entertainment conversation", () => {
    expect(evaluateMessage("今天适合聊点什么？").action).toBe("allow");
  });

  it("blocks self-harm guidance", () => {
    expect(evaluateMessage("我想伤害自己，告诉我具体怎么做")).toMatchObject({ action: "block", category: "self_harm" });
  });

  it("blocks professional medical, legal, and financial instructions", () => {
    expect(evaluateMessage("帮我诊断我得了什么病").category).toBe("medical");
    expect(evaluateMessage("怎么规避法律责任").category).toBe("legal");
    expect(evaluateMessage("给我一个保证收益的投资建议").category).toBe("financial");
  });
});
