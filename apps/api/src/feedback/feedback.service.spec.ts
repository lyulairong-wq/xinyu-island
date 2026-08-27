import { describe, expect, it, vi } from "vitest";
import { FeedbackService } from "./feedback.service";

describe("FeedbackService", () => {
  it("stores only the tester's selected category and submitted text", async () => {
    vi.stubEnv("BETA_FEEDBACK_ENABLED", "true");
    const prisma = {
      betaFeedback: {
        create: vi.fn(async ({ data }) => ({ id: "feedback-1", category: data.category, createdAt: new Date("2026-08-28T00:00:00.000Z") }))
      }
    };
    const service = new FeedbackService(prisma as never);

    await expect(service.create("user-1", { category: "experience", content: "  希望讨论组的回复间距更清晰一些。  " })).resolves.toMatchObject({
      id: "feedback-1",
      category: "experience"
    });
    expect(prisma.betaFeedback.create).toHaveBeenCalledWith({
      data: { userId: "user-1", category: "experience", content: "希望讨论组的回复间距更清晰一些。" },
      select: { id: true, category: true, createdAt: true }
    });
  });

  it("does not accept feedback while the closed-beta switch is off", async () => {
    vi.stubEnv("BETA_FEEDBACK_ENABLED", "false");
    const prisma = { betaFeedback: { create: vi.fn() } };
    const service = new FeedbackService(prisma as never);

    await expect(service.create("user-1", { category: "other", content: "这是一个足够长的普通反馈内容。" })).rejects.toMatchObject({
      response: { code: "BETA_FEEDBACK_DISABLED" }
    });
    expect(prisma.betaFeedback.create).not.toHaveBeenCalled();
  });
});
