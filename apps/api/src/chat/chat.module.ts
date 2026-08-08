import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({ imports: [ContactsModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
