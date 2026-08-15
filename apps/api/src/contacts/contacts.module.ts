import { Module } from "@nestjs/common";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { AuthModule } from "../auth/auth.module";
import { SkillCatalog } from "../skills/skill-catalog";

@Module({ imports: [AuthModule], controllers: [ContactsController], providers: [ContactsService, SkillCatalog], exports: [ContactsService] })
export class ContactsModule {}
