import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController, MeController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET ?? "xinyu-local-development-secret" })],
  controllers: [AuthController, MeController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService]
})
export class AuthModule {}
