import { describe, expect, it, vi } from "vitest";
import { ChatService } from "./chat.service";

function createPrismaMock() {
  const conversations = new Map<string, { id: string; userId: string; contactId: string; messages: unknown[] }>();
  return {
    user: { findUnique: vi.fn(async () => ({ defaultMemoryEnabled: false })) },
    conversation: {
      create: vi.fn(async ({ data }: { data: { userId: string; contactId: string } }) => {
        const item = { id: "conversation-1", ...data, messages: [] };
        conversations.set(item.id, item);
        return item;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const item = conversations.get(where.id);
        return item?.userId === where.userId ? item : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, ...data })),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        conversations.delete(where.id);
        return { id: where.id };
      })
    },
    message: {
      create: vi.fn(async ({ data }: { data: { conversationId: string; role: string; content: string; mode: string } }) => ({ id: `${data.role}-1`, ...data, createdAt: new Date() }))
    }
  };
}

const contactsMock = { resolve: vi.fn(async (_userId: string, contactId: string) => ({ id: contactId, name: "林屿", tagline: "安静听你说", description: "", avatar: "林", tone: "温和" })) };
const usageMock = { assertAvailable: vi.fn(async () => undefined), consume: vi.fn(async () => undefined) };

describe("ChatService", () => {
  it("persists an official conversation and returns a free mock reply", async () => {
    const prisma = createPrismaMock();
    const service = new ChatService(prisma as never, contactsMock as never, usageMock as never);
    const conversation = await service.createConversation("user-1", "lin");
    const result = await service.sendMessage("user-1", conversation.id, { content: "你好", mode: "free", memoryEnabled: false });
    expect("assistantMessage" in result).toBe(true);
    if ("assistantMessage" in result) {
      expect(result.assistantMessage.role).toBe("assistant");
      expect(result.assistantMessage.content).toContain("林屿");
    }
    expect(result.chargedTokens).toBe(0);
    expect(prisma.message.create).toHaveBeenCalledTimes(2);
  });

  it("keeps conversations isolated by owner", async () => {
    const prisma = createPrismaMock();
    const service = new ChatService(prisma as never, contactsMock as never, usageMock as never);
    const conversation = await service.createConversation("user-1", "lin");
    await expect(service.getConversation("user-2", conversation.id)).rejects.toThrow();
  });

  it("updates and deletes a conversation only for its owner", async () => {
    const prisma = createPrismaMock();
    const service = new ChatService(prisma as never, contactsMock as never, usageMock as never);
    const conversation = await service.createConversation("user-1", "lin");

    await service.updateConversation("user-1", conversation.id, { title: "My chat", archived: true });
    expect(prisma.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: conversation.id },
      data: expect.objectContaining({ title: "My chat", archivedAt: expect.any(Date) })
    }));

    await expect(service.deleteConversation("user-2", conversation.id)).rejects.toThrow();
    await expect(service.deleteConversation("user-1", conversation.id)).resolves.toEqual({ success: true });
  });
});
