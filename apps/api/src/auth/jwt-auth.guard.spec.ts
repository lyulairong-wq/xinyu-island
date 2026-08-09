import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  it("requires the session owner to remain active", async () => {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: "user-1", sid: "session-1" }) };
    const prisma = { userSession: { findFirst: vi.fn().mockResolvedValue(null) } };
    const request = { headers: { authorization: "Bearer access-token" } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };
    const guard = new JwtAuthGuard(jwt as never, prisma as never);

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.userSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ user: { status: "active" } })
    }));
  });
});
