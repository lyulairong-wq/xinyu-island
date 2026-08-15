import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ChatController } from "./chat.controller";

const user = { id: "user-1" } as AuthenticatedUser;

describe("ChatController skill-session endpoints", () => {
  it("starts exactly one skill session through the skill service", async () => {
    const sessions = {
      start: vi.fn(async () => ({ skillCard: { skill: "tarot" } })),
      remember: vi.fn()
    };
    const controller = new ChatController({} as never, sessions as never);
    const input = {
      skill: "tarot" as const,
      topic: "最近的感受",
      mode: "free" as const,
      requestId: "123e4567-e89b-42d3-a456-426614174000"
    };

    const result = await controller.startSkillSession(user, "conversation-1", input);

    expect(sessions.start).toHaveBeenCalledWith(user.id, "conversation-1", input);
    expect(result).toEqual({ skillCard: { skill: "tarot" } });
  });

  it("saves memory only through the separate explicit action", async () => {
    const sessions = {
      start: vi.fn(),
      remember: vi.fn(async () => ({ id: "memory-1", source: "user_explicit" }))
    };
    const controller = new ChatController({} as never, sessions as never);
    const input = { fact: "请提醒我多休息", sensitivity: "normal" as const };

    const result = await controller.rememberSkillFact(user, "conversation-1", "hui", input);

    expect(sessions.remember).toHaveBeenCalledWith(user.id, "conversation-1", "hui", input);
    expect(result).toEqual({ id: "memory-1", source: "user_explicit" });
  });
});
