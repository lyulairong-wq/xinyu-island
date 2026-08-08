import { Controller, Get, Module } from "@nestjs/common";
import type { HealthResponse } from "@xinyu/contracts";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";

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
  imports: [PrismaModule, AuthModule],
  controllers: [AppController]
})
export class AppModule {}
