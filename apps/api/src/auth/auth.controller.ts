import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthenticatedUser } from "./auth.types";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post("login")
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logout(user.id, user.sessionId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getSessions(user.id);
  }
}

@Controller("me")
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.id);
  }
}
