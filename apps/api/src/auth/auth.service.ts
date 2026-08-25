import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CURRENT_CONSENT_DOCUMENT_VERSION, hasRequiredConsents, normalizeEmail, REQUIRED_CONSENT_TYPES } from "./auth.policy";
import type { RegisterDto } from "./dto/register.dto";
import type { LoginDto } from "./dto/login.dto";

const SESSION_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(input: RegisterDto) {
    const email = normalizeEmail(input.email);
    const consentTypes = input.consents.map((consent) => consent.type);
    if (!hasRequiredConsents(consentTypes)) {
      throw new ConflictException("必须同意用户协议、隐私政策和娱乐使用提示");
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("该邮箱已注册");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, nickname: input.nickname.trim(), ageBand: input.ageBand }
      });
      await tx.consentRecord.createMany({
        data: input.consents
          .filter((consent, index, all) => all.findIndex((item) => item.type === consent.type) === index)
          .map((consent) => ({
            userId: created.id,
            consentType: consent.type,
            documentVersion: CURRENT_CONSENT_DOCUMENT_VERSION,
            source: "web"
          }))
      });
      await tx.tokenAccount.create({ data: { userId: created.id, freeResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
      return created;
    });
    return this.createSession(user.id, input.deviceLabel);
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } });
    if (!user || user.status !== "active" || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("邮箱或密码不正确");
    }
    return this.createSession(user.id, input.deviceLabel);
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({ where: { id: sessionId, userId }, data: { revokedAt: new Date() } });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nickname: true, ageBand: true, status: true, defaultMemoryEnabled: true, createdAt: true }
    });
    if (!user) throw new UnauthorizedException("用户不存在");
    return user;
  }

  async getSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, deviceLabel: true, lastSeenAt: true, expiresAt: true, createdAt: true },
      orderBy: { lastSeenAt: "desc" }
    });
  }

  private async createSession(userId: string, deviceLabel?: string) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const placeholder = createHash("sha256").update(`${userId}:${Date.now()}:${Math.random()}`).digest("hex");
    const session = await this.prisma.userSession.create({
      data: { userId, tokenHash: placeholder, deviceLabel, expiresAt }
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: session.id }, { expiresIn: "7d" });
    const tokenHash = createHash("sha256").update(accessToken).digest("hex");
    await this.prisma.userSession.update({ where: { id: session.id }, data: { tokenHash } });
    return { accessToken, sessionId: session.id, user: await this.getProfile(userId), requiredConsentTypes: REQUIRED_CONSENT_TYPES };
  }
}
