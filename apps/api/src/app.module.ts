import { Controller, Get, Module } from "@nestjs/common";
import type { HealthResponse } from "@xinyu/contracts";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ChatModule } from "./chat/chat.module";
import { UsageModule } from "./usage/usage.module";

@Controller()
class AppController {
  @Get("health")
  health(): HealthResponse {
    return {
      service: "xinyu-api",
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }
}

@Module({
  imports: [PrismaModule, AuthModule, ContactsModule, ChatModule, UsageModule],
  controllers: [AppController]
})
export class AppModule {}
