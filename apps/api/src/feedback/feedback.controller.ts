import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateBetaFeedbackDto } from "./dto/create-beta-feedback.dto";
import { FeedbackService } from "./feedback.service";

@Controller("me/beta-feedback")
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateBetaFeedbackDto) {
    return this.feedback.create(user.id, input);
  }
}
