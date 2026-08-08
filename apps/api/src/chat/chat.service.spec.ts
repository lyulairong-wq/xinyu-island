import { describe, expect, it } from "vitest";
import { ChatService } from "./chat.service";

describe("ChatService", () => {
  it("creates an official conversation and returns a free mock reply", async () => {
    const service = new ChatService();
    const conversation = service.createConversation("user-1", "lin");
    const result = await service.sendMessage("user-1", conversation.id, { content: "你好", mode: "free", memoryEnabled: false });
    expect(result.assistantMessage.role).toBe("assistant");
    expect(result.assistantMessage.content).toContain("林屿");
    expect(result.chargedTokens).toBe(0);
  });

  it("keeps conversations isolated by owner", () => {
    const service = new ChatService();
    const conversation = service.createConversation("user-1", "lin");
    expect(() => service.getConversation("user-2", conversation.id)).toThrow();
  });
});
