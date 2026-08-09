import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";
import { CreateGroupDto } from "./dto/create-group.dto";

@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("conversations")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: { contactId: string; memoryEnabled?: boolean }) {
    return this.chat.createConversation(user.id, body.contactId, body.memoryEnabled);
  }

  @Get("conversations")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.listConversations(user.id);
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
    return this.chat.updateConversationSettings(user.id, conversationId, input.memoryEnabled);
  }

  @Post("conversations/:conversationId/messages")
  async send(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string, @Body() input: SendMessageDto) {
    return this.chat.sendMessage(user.id, conversationId, input);
  }
}
