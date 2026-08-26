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
  user: { create: vi.fn(), delete: vi.fn() },
  consentRecord: { createMany: vi.fn() },
  tokenAccount: { create: vi.fn() },
  userSession: { updateMany: vi.fn() }
};

const prisma = {
  user: { findUnique: vi.fn() },
  consentRecord: { findMany: vi.fn() },
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
    transaction.user.delete.mockResolvedValue({ id: "user-1" });
    transaction.userSession.updateMany.mockResolvedValue({ count: 1 });
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

  it("persists the server-defined document version instead of a client-supplied version", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      nickname: "Xinyu",
      ageBand: "18_plus",
      status: "active",
      createdAt: new Date("2026-08-09T00:00:00.000Z")
    });

    await service.register({
      ...baseInput,
      consents: baseInput.consents.map((consent) => ({ ...consent, version: "obsolete-client-version" }))
    });

    expect(transaction.consentRecord.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ documentVersion: "1.0" })
      ])
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

  it("includes the default memory preference in the authenticated profile", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1", email: "user@example.com", nickname: "Xinyu", ageBand: "18_plus", status: "active",
      defaultMemoryEnabled: true, createdAt: new Date("2026-08-09T00:00:00.000Z")
    });

    await expect(service.getProfile("user-1")).resolves.toMatchObject({ defaultMemoryEnabled: true });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ defaultMemoryEnabled: true })
    }));
  });

  it("lists only active sessions belonging to the current user", async () => {
    await service.getSessions("user-1");

    expect(prisma.userSession.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      select: { id: true, deviceLabel: true, lastSeenAt: true, expiresAt: true, createdAt: true },
      orderBy: { lastSeenAt: "desc" }
    });
  });

  it("returns the current user's active consent documents in the shared catalog order", async () => {
    const termsGrantedAt = new Date("2026-08-01T00:00:00.000Z");
    const privacyGrantedAt = new Date("2026-08-02T00:00:00.000Z");
    const noticeGrantedAt = new Date("2026-08-03T00:00:00.000Z");
    prisma.consentRecord.findMany.mockResolvedValue([
      { consentType: "privacy", grantedAt: privacyGrantedAt },
      { consentType: "entertainment_notice", grantedAt: noticeGrantedAt },
      { consentType: "terms", grantedAt: termsGrantedAt }
    ]);

    await expect(service.getConsents("user-1")).resolves.toEqual({
      documents: [
        expect.objectContaining({ type: "terms", version: "1.0", grantedAt: termsGrantedAt }),
        expect.objectContaining({ type: "privacy", version: "1.0", grantedAt: privacyGrantedAt }),
        expect.objectContaining({ type: "entertainment_notice", version: "1.0", grantedAt: noticeGrantedAt })
      ]
    });

    expect(prisma.consentRecord.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", granted: true, revokedAt: null },
      select: { consentType: true, grantedAt: true }
    });
  });

  it("rejects a missing required active consent as an invalid authorization state", async () => {
    prisma.consentRecord.findMany.mockResolvedValue([
      { consentType: "terms", grantedAt: new Date("2026-08-01T00:00:00.000Z") },
      { consentType: "privacy", grantedAt: new Date("2026-08-02T00:00:00.000Z") }
    ]);

    await expect(service.getConsents("user-1")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an invalid account-deletion password without deleting the user", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "password-hash" });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(service.deleteAccount("user-1", "wrong-password")).rejects.toMatchObject({ status: 400 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.user.delete).not.toHaveBeenCalled();
  });

  it("rejects account deletion for a missing authenticated user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.deleteAccount("user-1", "password123")).rejects.toMatchObject({ status: 401 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("revokes every session and hard-deletes the user in one transaction", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "password-hash" });

    await expect(service.deleteAccount("user-1", "password123")).resolves.toBeUndefined();

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { passwordHash: true }
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { revokedAt: expect.any(Date) }
    });
    expect(transaction.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(transaction.userSession.updateMany.mock.invocationCallOrder[0]!).toBeLessThan(
      transaction.user.delete.mock.invocationCallOrder[0]!
    );
  });
});
