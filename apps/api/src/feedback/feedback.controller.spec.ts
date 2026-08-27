import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { FeedbackController } from "./feedback.controller";

describe("FeedbackController", () => {
  it("routes an authenticated tester's explicit feedback to the service", async () => {
    const feedback = { create: vi.fn(async () => ({ id: "feedback-1" })) };
    const controller = new FeedbackController(feedback as never);
    const input = { category: "chat" as const, content: "模型回复偶尔需要等待较长时间。" };

    await expect(controller.create({ id: "user-1" } as never, input)).resolves.toEqual({ id: "feedback-1" });
    expect(feedback.create).toHaveBeenCalledWith("user-1", input);
    expect(Reflect.getMetadata(PATH_METADATA, FeedbackController.prototype.create)).toBe("/");
    expect(Reflect.getMetadata(METHOD_METADATA, FeedbackController.prototype.create)).toBe(RequestMethod.POST);
  });
});
