import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { SkillCatalog } from "../skills/skill-catalog";
import { ContactsService } from "./contacts.service";

const userId = "user-1";
const privateContact = {
  id: "private-1",
  userId,
  name: "Ming",
  tagline: "A private contact",
  description: "",
  tone: "warm",
  avatar: "M",
  skillCodes: ["tarot", "mbti"],
  primarySkill: "tarot"
};

const prisma = {
  privateContact: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  }
};

describe("ContactsService skill configuration", () => {
  let service: ContactsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContactsService(prisma as unknown as PrismaService, new SkillCatalog());
    prisma.privateContact.findFirst.mockResolvedValue({ ...privateContact });
    prisma.privateContact.findMany.mockResolvedValue([{ ...privateContact }]);
    prisma.privateContact.create.mockImplementation(async ({ data }) => ({ id: "private-2", ...data }));
    prisma.privateContact.update.mockImplementation(async ({ where, data }) => ({ ...privateContact, id: where.id, ...data }));
  });

  it("rejects more than three, unknown, or non-primary configured skill codes without updating", async () => {
    const invalidConfigurations = [
      { skillCodes: ["tarot", "mbti", "zodiac", "ziwei"], primarySkill: "tarot" },
      { skillCodes: ["tarot", "unapproved"], primarySkill: "tarot" },
      { skillCodes: ["tarot", "mbti"], primarySkill: "zodiac" }
    ];

    for (const input of invalidConfigurations) {
      await expect(service.updateSkills(userId, privateContact.id, input as never)).rejects.toMatchObject({
        response: { code: "CONTACT_SKILLS_INVALID" }
      });
    }

    expect(prisma.privateContact.update).not.toHaveBeenCalled();
  });

  it("rejects attempts to edit immutable official contact skills without updating a private contact", async () => {
    await expect(service.updateSkills(userId, "hui", { skillCodes: ["mbti"], primarySkill: "mbti" } as never)).rejects.toMatchObject({
      response: { code: "OFFICIAL_CONTACT_IMMUTABLE" }
    });

    expect(prisma.privateContact.update).not.toHaveBeenCalled();
  });

  it("rejects another user's contact before persisting a skill change", async () => {
    prisma.privateContact.findFirst.mockResolvedValue(null);

    await expect(service.updateSkills(userId, privateContact.id, { skillCodes: ["mbti"], primarySkill: "mbti" } as never)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.privateContact.findFirst).toHaveBeenCalledWith({ where: { id: privateContact.id, userId } });
    expect(prisma.privateContact.update).not.toHaveBeenCalled();
  });

  it("persists approved skills in request order and returns an editable private contact", async () => {
    const result = await service.updateSkills(userId, privateContact.id, {
      skillCodes: ["zodiac", "tarot"],
      primarySkill: "tarot"
    } as never);

    expect(prisma.privateContact.update).toHaveBeenCalledWith({
      where: { id: privateContact.id },
      data: { skillCodes: ["zodiac", "tarot"], primarySkill: "tarot" }
    });
    expect(result).toMatchObject({
      id: privateContact.id,
      type: "private",
      skills: ["zodiac", "tarot"],
      primarySkill: "tarot",
      editable: true
    });
  });

  it("creates and lists private contacts with approved skills alongside read-only official profiles", async () => {
    const created = await service.create(userId, {
      name: "  Ming  ",
      skillCodes: ["tarot", "mbti"],
      primarySkill: "mbti"
    } as never);
    const contacts = await service.list(userId);

    expect(prisma.privateContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        name: "Ming",
        skillCodes: ["tarot", "mbti"],
        primarySkill: "mbti"
      })
    });
    expect(created).toMatchObject({ type: "private", skills: ["tarot", "mbti"], primarySkill: "mbti", editable: true });
    expect(contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "hui", type: "official", skills: ["tarot"], primarySkill: "tarot", editable: false }),
      expect.objectContaining({ id: privateContact.id, type: "private", skills: ["tarot", "mbti"], primarySkill: "tarot", editable: true })
    ]));
  });
});
