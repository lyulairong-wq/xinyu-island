import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { SkillCode } from "@xinyu/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { SkillCatalog } from "../skills/skill-catalog";
import { OFFICIAL_CONTACTS } from "./official-contacts";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { CreateMemoryDto } from "./dto/create-memory.dto";
import type { UpdateContactSkillsDto } from "./dto/update-contact-skills.dto";

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skills: SkillCatalog
  ) {}

  async list(userId: string) {
    const privateContacts = await this.prisma.privateContact.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
    return [...OFFICIAL_CONTACTS.map((contact) => this.toOfficialContactResponse(contact)), ...privateContacts.map((contact) => this.toPrivateContactResponse(contact))];
  }

  async create(userId: string, input: CreateContactDto) {
    const configuration = this.validateSkillConfiguration(input);
    const contact = await this.prisma.privateContact.create({
      data: {
        userId,
        name: input.name.trim(),
        tagline: input.tagline?.trim(),
        description: input.description?.trim(),
        tone: input.tone?.trim(),
        avatar: input.name.trim().slice(0, 1),
        ...configuration
      }
    });
    return this.toPrivateContactResponse(contact);
  }

  async updateSkills(userId: string, contactId: string, input: UpdateContactSkillsDto) {
    if (OFFICIAL_CONTACTS.some((contact) => contact.id === contactId)) {
      throw new ForbiddenException({ code: "OFFICIAL_CONTACT_IMMUTABLE" });
    }

    const contact = await this.prisma.privateContact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new NotFoundException("找不到该联系人");

    const configuration = this.validateSkillConfiguration(input);
    const updated = await this.prisma.privateContact.update({ where: { id: contact.id }, data: configuration });
    return this.toPrivateContactResponse(updated);
  }

  async remove(userId: string, contactId: string) {
    const contact = await this.prisma.privateContact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new NotFoundException("找不到该私有 AI 联系人");
    await this.prisma.privateContact.delete({ where: { id: contact.id } });
    return { success: true };
  }

  async listMemories(userId: string, contactId: string) {
    await this.assertContactAccess(userId, contactId);
    return this.prisma.contactMemory.findMany({ where: { userId, contactId }, orderBy: { updatedAt: "desc" } });
  }

  async createMemory(userId: string, contactId: string, input: CreateMemoryDto) {
    await this.assertContactAccess(userId, contactId);
    return this.prisma.contactMemory.create({ data: { userId, contactId, fact: input.fact.trim(), sensitivity: input.sensitivity, source: "user_explicit" } });
  }

  async removeMemory(userId: string, memoryId: string) {
    const memory = await this.prisma.contactMemory.findFirst({ where: { id: memoryId, userId } });
    if (!memory) throw new NotFoundException("找不到该记忆");
    await this.prisma.contactMemory.delete({ where: { id: memory.id } });
    return { success: true };
  }

  async updateDefaultMemory(userId: string, enabled: boolean) {
    return this.prisma.user.update({ where: { id: userId }, data: { defaultMemoryEnabled: enabled }, select: { defaultMemoryEnabled: true } });
  }

  async assertContactAccess(userId: string, contactId: string) {
    if (OFFICIAL_CONTACTS.some((contact) => contact.id === contactId)) return;
    const privateContact = await this.prisma.privateContact.findFirst({ where: { id: contactId, userId } });
    if (!privateContact) throw new NotFoundException("找不到该联系人");
  }

  async resolve(userId: string, contactId: string) {
    const official = OFFICIAL_CONTACTS.find((contact) => contact.id === contactId);
    if (official) return this.toOfficialContactResponse(official);
    const privateContact = await this.prisma.privateContact.findFirst({ where: { id: contactId, userId } });
    if (!privateContact) throw new NotFoundException("找不到该联系人");
    return this.toPrivateContactResponse(privateContact);
  }

  private validateSkillConfiguration(input: Pick<UpdateContactSkillsDto, "skillCodes" | "primarySkill">) {
    const skillCodes = input.skillCodes as readonly unknown[];
    const primarySkill = input.primarySkill as unknown;
    if (!Array.isArray(skillCodes) || skillCodes.length === 0 || skillCodes.length > 3 || typeof primarySkill !== "string") {
      throw this.invalidSkills();
    }

    const approvedSkills = skillCodes.map((code) => this.resolveSkillCode(code));
    const approvedPrimarySkill = this.resolveSkillCode(primarySkill);
    if (!approvedSkills.includes(approvedPrimarySkill)) throw this.invalidSkills();

    return { skillCodes: approvedSkills, primarySkill: approvedPrimarySkill };
  }

  private resolveSkillCode(code: unknown): SkillCode {
    if (typeof code !== "string") throw this.invalidSkills();
    try {
      this.skills.get(code as SkillCode);
      return code as SkillCode;
    } catch {
      throw this.invalidSkills();
    }
  }

  private toOfficialContactResponse(contact: (typeof OFFICIAL_CONTACTS)[number]) {
    return {
      ...contact,
      type: "official" as const,
      skills: [...contact.skills],
      primarySkill: contact.primarySkill,
      editable: false,
      canDelete: false
    };
  }

  private toPrivateContactResponse(contact: Awaited<ReturnType<PrismaService["privateContact"]["findFirst"]>> & {}) {
    if (!contact) throw new NotFoundException("找不到该联系人");
    const { skillCodes, primarySkill, ...profile } = contact;
    return {
      ...profile,
      tagline: profile.tagline ?? "你的私有 AI 联系人",
      description: profile.description ?? "",
      avatar: profile.avatar ?? profile.name.slice(0, 1),
      tone: profile.tone ?? "自然、友好",
      type: "private" as const,
      skills: skillCodes.map((code) => this.resolveSkillCode(code)),
      primarySkill: primarySkill === null ? undefined : this.resolveSkillCode(primarySkill),
      editable: true,
      canDelete: true
    };
  }

  private invalidSkills() {
    return new BadRequestException({ code: "CONTACT_SKILLS_INVALID" });
  }
}
