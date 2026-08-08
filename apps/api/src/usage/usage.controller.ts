import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { UsageService } from "./usage.service";

@UseGuards(JwtAuthGuard)
@Controller("usage")
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  summary(@CurrentUser() user: AuthenticatedUser) { return this.usage.getSummary(user.id); }

  @Get("records")
  records(@CurrentUser() user: AuthenticatedUser) { return this.usage.listRecords(user.id); }
}
