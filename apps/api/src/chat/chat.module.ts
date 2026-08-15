import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { UsageModule } from "../usage/usage.module";
import { ModelGatewayModule } from "../model-gateway/model-gateway.module";
import { AuthModule } from "../auth/auth.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { SkillsModule } from "../skills/skills.module";

@Module({ imports: [AuthModule, ContactsModule, UsageModule, ModelGatewayModule, SkillsModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
