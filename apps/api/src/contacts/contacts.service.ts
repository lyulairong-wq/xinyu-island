import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OFFICIAL_CONTACTS } from "./official-contacts";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { CreateMemoryDto } from "./dto/create-memory.dto";

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const privateContacts = await this.prisma.privateContact.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
    return [...OFFICIAL_CONTACTS.map((contact) => ({ ...contact, type: "official" as const, canDelete: false })), ...privateContacts.map((contact) => ({ ...contact, type: "private" as const, canDelete: true }))];
  }

  async create(userId: string, input: CreateContactDto) {
    return this.prisma.privateContact.create({ data: { userId, name: input.name.trim(), tagline: input.tagline?.trim(), description: input.description?.trim(), tone: input.tone?.trim(), avatar: input.name.trim().slice(0, 1) } });
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
    if (official) return official;
    const privateContact = await this.prisma.privateContact.findFirst({ where: { id: contactId, userId } });
    if (!privateContact) throw new NotFoundException("找不到该联系人");
    return { id: privateContact.id, name: privateContact.name, tagline: privateContact.tagline ?? "你的私有 AI 联系人", description: privateContact.description ?? "", avatar: privateContact.avatar ?? privateContact.name.slice(0, 1), tone: privateContact.tone ?? "自然、友好" };
  }
}
