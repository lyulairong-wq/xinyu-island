import { Controller, Get, Module, ServiceUnavailableException } from "@nestjs/common";
import type { HealthResponse } from "@xinyu/contracts";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ChatModule } from "./chat/chat.module";
import { UsageModule } from "./usage/usage.module";
import { PrismaService } from "./prisma/prisma.service";

@Controller()
class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health(): HealthResponse {
    return {
      service: "xinyu-api",
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }

  @Get("health/ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { service: "xinyu-api", status: "ready", dependencies: { database: "ok" } };
    } catch {
      throw new ServiceUnavailableException({ code: "DATABASE_UNAVAILABLE", message: "数据库暂不可用" });
    }
  }
}

@Module({
  imports: [PrismaModule, AuthModule, ContactsModule, ChatModule, UsageModule],
  controllers: [AppController]
})
export class AppModule {}
