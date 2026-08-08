import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto/send-message.dto";

@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("conversations")
  async create(@CurrentUser() user: AuthenticatedUser, @Body("contactId") contactId: string) {
    return this.chat.createConversation(user.id, contactId);
  }

  @Get("conversations/:conversationId")
  get(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string) {
    return this.chat.getConversation(user.id, conversationId);
  }

  @Post("conversations/:conversationId/messages")
  async send(@CurrentUser() user: AuthenticatedUser, @Param("conversationId") conversationId: string, @Body() input: SendMessageDto) {
    return this.chat.sendMessage(user.id, conversationId, input);
  }
}
