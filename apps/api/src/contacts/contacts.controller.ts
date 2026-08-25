import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ContactsService } from "./contacts.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { CreateMemoryDto } from "./dto/create-memory.dto";
import { UpdateContactSkillsDto } from "./dto/update-contact-skills.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { RemoveContactDto } from "./dto/remove-contact.dto";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.contacts.list(user.id); }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateContactDto) { return this.contacts.create(user.id, input); }

  @UseGuards(JwtAuthGuard)
  @Patch("settings/memory-default")
  updateDefaultMemory(@CurrentUser() user: AuthenticatedUser, @Body("enabled") enabled: boolean) { return this.contacts.updateDefaultMemory(user.id, enabled); }

  @UseGuards(JwtAuthGuard)
  @Get("deleted-records")
  deletedRecords(@CurrentUser() user: AuthenticatedUser) { return this.contacts.listDeletedRecords(user.id); }

  @UseGuards(JwtAuthGuard)
  @Delete(":contactId")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("contactId") contactId: string, @Body() input: RemoveContactDto) { return this.contacts.remove(user.id, contactId, input); }

  @UseGuards(JwtAuthGuard)
  @Patch(":contactId")
  update(@CurrentUser() user: AuthenticatedUser, @Param("contactId") contactId: string, @Body() input: UpdateContactDto) {
    return this.contacts.update(user.id, contactId, input);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":contactId/skills")
  updateSkills(@CurrentUser() user: AuthenticatedUser, @Param("contactId") contactId: string, @Body() input: UpdateContactSkillsDto) {
    return this.contacts.updateSkills(user.id, contactId, input);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":contactId/memories")
  memories(@CurrentUser() user: AuthenticatedUser, @Param("contactId") contactId: string) { return this.contacts.listMemories(user.id, contactId); }

  @UseGuards(JwtAuthGuard)
  @Post(":contactId/memories")
  createMemory(@CurrentUser() user: AuthenticatedUser, @Param("contactId") contactId: string, @Body() input: CreateMemoryDto) { return this.contacts.createMemory(user.id, contactId, input); }

  @UseGuards(JwtAuthGuard)
  @Delete("memories/:memoryId")
  removeMemory(@CurrentUser() user: AuthenticatedUser, @Param("memoryId") memoryId: string) { return this.contacts.removeMemory(user.id, memoryId); }

}
