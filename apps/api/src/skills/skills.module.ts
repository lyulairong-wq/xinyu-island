import { Module } from "@nestjs/common";
import { GenerationPolicy } from "../chat/generation-policy";
import { ChatGenerationCoordinator } from "../chat/chat-generation-coordinator";
import { ContactsModule } from "../contacts/contacts.module";
import { ModelGatewayModule } from "../model-gateway/model-gateway.module";
import { UsageModule } from "../usage/usage.module";
import { SkillCatalog } from "./skill-catalog";
import { SkillSessionService } from "./skill-session.service";

@Module({
  imports: [ContactsModule, UsageModule, ModelGatewayModule],
  providers: [GenerationPolicy, ChatGenerationCoordinator, SkillCatalog, SkillSessionService],
  exports: [SkillSessionService]
})
export class SkillsModule {}
