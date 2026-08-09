import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("登录状态已失效");

    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; sid?: string }>(header.slice(7));
      if (!payload.sub || !payload.sid) throw new Error("invalid payload");
      const session = await this.prisma.userSession.findFirst({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null, user: { status: "active" } }
      });
      if (!session || session.expiresAt <= new Date()) throw new Error("expired session");
      request.user = { id: payload.sub, sessionId: payload.sid };
      return true;
    } catch {
      throw new UnauthorizedException("登录状态已失效");
    }
  }
}
