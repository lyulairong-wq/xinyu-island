import { ForbiddenException, Injectable } from "@nestjs/common";
import { loadBetaConfig } from "@xinyu/config";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateBetaFeedbackDto } from "./dto/create-beta-feedback.dto";

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateBetaFeedbackDto) {
    if (!loadBetaConfig(process.env).feedbackEnabled) {
      throw new ForbiddenException({ code: "BETA_FEEDBACK_DISABLED" });
    }
    const content = input.content.trim();
    return this.prisma.betaFeedback.create({
      data: { userId, category: input.category, content },
      select: { id: true, category: true, createdAt: true }
    });
  }
}
