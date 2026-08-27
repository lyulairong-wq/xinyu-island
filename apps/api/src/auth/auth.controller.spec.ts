import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import { AuthController, MeController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("MeController", () => {
  it("registers guarded consent retrieval for the authenticated current user", async () => {
    const auth = { getConsents: vi.fn().mockResolvedValue({ documents: [] }) };
    const controller = new MeController(auth as unknown as AuthService);

    await expect(controller.consents({ id: "user-1", sessionId: "session-1" })).resolves.toEqual({ documents: [] });

    expect(auth.getConsents).toHaveBeenCalledWith("user-1");
    expect(Reflect.getMetadata(PATH_METADATA, MeController.prototype.consents)).toBe("consents");
    expect(Reflect.getMetadata(METHOD_METADATA, MeController.prototype.consents)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(GUARDS_METADATA, MeController.prototype.consents)).toContain(JwtAuthGuard);
  });

  it("registers guarded account deletion using only the authenticated user id", async () => {
    const auth = { deleteAccount: vi.fn().mockResolvedValue(undefined) };
    const controller = new MeController(auth as unknown as AuthService);

    await expect(
      controller.deleteAccount(
        { id: "user-1", sessionId: "session-1" },
        { password: "password123", confirmed: true }
      )
    ).resolves.toEqual({ success: true });

    expect(auth.deleteAccount).toHaveBeenCalledWith("user-1", "password123");
    expect(Reflect.getMetadata(PATH_METADATA, MeController.prototype.deleteAccount)).toBe("account-deletion");
    expect(Reflect.getMetadata(METHOD_METADATA, MeController.prototype.deleteAccount)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(GUARDS_METADATA, MeController.prototype.deleteAccount)).toContain(JwtAuthGuard);
  });
});

describe("AuthController", () => {
  it("makes beta experience switches available without authentication", () => {
    const auth = { betaInfo: vi.fn(() => ({ requireInviteCode: true })) };
    const controller = new AuthController(auth as unknown as AuthService);

    expect(controller.betaInfo()).toEqual({ requireInviteCode: true });
    expect(auth.betaInfo).toHaveBeenCalledTimes(1);
    expect(Reflect.getMetadata(PATH_METADATA, AuthController.prototype.betaInfo)).toBe("beta-info");
    expect(Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.betaInfo)).toBe(RequestMethod.GET);
  });
});
