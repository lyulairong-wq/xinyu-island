import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { SkillSessionService } from "../skills/skill-session.service";
import { StartSkillSessionDto } from "../skills/dto/start-skill-session.dto";
import { CreateMemoryDto } from "../contacts/dto/create-memory.dto";

@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly skillSessions: SkillSessionService
  ) {}

  @Post("conversations")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: { contactId: string; memoryEnabled?: boolean }) {
    return this.chat.createConversation(user.id, body.contactId, body.memoryEnabled);
  }

  @Get("conversations")
  list(@CurrentUser() user: AuthenticatedUser, @Query("includeArchived") includeArchived?: string) {
    return this.chat.listConversations(user.id, includeArchived === "true");
  }

  @Post("groups")
  createGroup(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateGroupDto) {
    return this.chat.createGroup(user.id, input.contactIds, input.memoryEnabled);
  }

  @Get("conversations/:conversationId")
  get(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string) {
    return this.chat.getConversation(user.id, conversationId);
  }

  @Patch("conversations/:conversationId/settings")
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string, @Body() input: UpdateConversationDto) {
    return this.chat.updateConversation(user.id, conversationId, input);
  }

  @Delete("conversations/:conversationId")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string) {
    return this.chat.deleteConversation(user.id, conversationId);
  }

  @Post("conversations/:conversationId/messages")
  async send(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string, @Body() input: SendMessageDto) {
    return this.chat.sendMessage(user.id, conversationId, input);
  }

  @Post("conversations/:conversationId/skill-sessions")
  startSkillSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() input: StartSkillSessionDto
  ) {
    return this.skillSessions.start(user.id, conversationId, input);
  }

  @Post("conversations/:conversationId/skill-sessions/:contactId/memories")
  rememberSkillFact(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Param("contactId") contactId: string,
    @Body() input: CreateMemoryDto
  ) {
    return this.skillSessions.remember(user.id, conversationId, contactId, input);
  }

  @Delete("conversations/:conversationId/messages/:messageId")
  removeMessage(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string, @Param("messageId") messageId: string) {
    return this.chat.deleteMessage(user.id, conversationId, messageId);
  }
}
