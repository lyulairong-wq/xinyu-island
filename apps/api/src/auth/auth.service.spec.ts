import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

vi.mock("bcrypt", () => ({
  compare: vi.fn(),
  hash: vi.fn()
}));

const baseInput = {
  email: "user@example.com",
  password: "password123",
  nickname: "Xinyu",
  ageBand: "18_plus",
  consents: [
    { type: "terms", version: "1.0" },
    { type: "privacy", version: "1.0" },
    { type: "entertainment_notice", version: "1.0" }
  ],
  deviceLabel: "web"
};

const transaction = {
  user: { create: vi.fn() },
  consentRecord: { createMany: vi.fn() },
  tokenAccount: { create: vi.fn() }
};

const prisma = {
  user: { findUnique: vi.fn() },
  userSession: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn()
};

const jwt = { signAsync: vi.fn() };

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
    prisma.$transaction.mockImplementation(async (callback) => callback(transaction));
    transaction.user.create.mockResolvedValue({ id: "user-1" });
    transaction.consentRecord.createMany.mockResolvedValue({ count: 3 });
    transaction.tokenAccount.create.mockResolvedValue({ id: "token-account-1" });
    prisma.userSession.create.mockResolvedValue({ id: "session-1" });
    prisma.userSession.update.mockResolvedValue({ id: "session-1" });
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.userSession.findMany.mockResolvedValue([]);
    jwt.signAsync.mockResolvedValue("access-token");
    vi.mocked(bcrypt.hash).mockResolvedValue("password-hash" as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  it("rejects registration before persisting when a required consent is missing", async () => {
    await expect(service.register({ ...baseInput, consents: [{ type: "terms", version: "1.0" }] })).rejects.toThrow("必须同意");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("persists required admission records in one transaction before opening a session", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      nickname: "Xinyu",
      ageBand: "18_plus",
      status: "active",
      createdAt: new Date("2026-08-09T00:00:00.000Z")
    });

    await expect(service.register(baseInput)).resolves.toMatchObject({ sessionId: "session-1", accessToken: "access-token" });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.consentRecord.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", consentType: "terms", documentVersion: "1.0", source: "web" },
        { userId: "user-1", consentType: "privacy", documentVersion: "1.0", source: "web" },
        { userId: "user-1", consentType: "entertainment_notice", documentVersion: "1.0", source: "web" }
      ]
    });
  });

  it("looks up a normalized email before creating a login session", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", status: "active", passwordHash: "password-hash" }).mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      nickname: "Xinyu",
      ageBand: "18_plus",
      status: "active",
      createdAt: new Date("2026-08-09T00:00:00.000Z")
    });

    await expect(service.login({ email: "  USER@example.com ", password: "password123", deviceLabel: "web" })).resolves.toMatchObject({
      sessionId: "session-1",
      accessToken: "access-token"
    });

    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, { where: { email: "user@example.com" } });
  });

  it("revokes only the named session owned by the current user", async () => {
    await service.logout("user-1", "session-1");

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", userId: "user-1" },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it("lists only active sessions belonging to the current user", async () => {
    await service.getSessions("user-1");

    expect(prisma.userSession.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      select: { id: true, deviceLabel: true, lastSeenAt: true, expiresAt: true, createdAt: true },
      orderBy: { lastSeenAt: "desc" }
    });
  });
});
