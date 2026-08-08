import { Controller, Get, Module } from "@nestjs/common";
import type { HealthResponse } from "@xinyu/contracts";

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
  controllers: [AppController]
})
export class AppModule {}
